<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use App\Models\Device;
use App\Models\NotificationLog;
use App\Models\User;
use Google\Auth\Credentials\ServiceAccountCredentials;
use GuzzleHttp\Client;

class SendPushNotification implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $userId, public string $title, public string $body, public array $data = []) {}

    /**
     * Execute the job.
     */
    public int $tries = 3;
    public int $backoff = 10;

    public function handle(): void
    {
        // 1. Notification in-app (stockée en base, affichée dans le dashboard)
        $user = User::find($this->userId);
        if ($user) {
            $user->notify(new \App\Notifications\InAppNotification(
                $this->title,
                $this->body,
                $this->data['type'] ?? 'info',
                $this->data
            ));
        }

        // 2. Récupérer les tokens push de l'utilisateur
        $tokens = Device::query()
            ->where('user_id', $this->userId)
            ->where('push_enabled', true)
            ->whereNotNull('fcm_token')
            ->pluck('fcm_token')
            ->all();

        if (empty($tokens)) {
            Log::info('[Push] Aucun token pour user '.$this->userId);
            return;
        }

        // 3. Séparer tokens Expo (ExponentPushToken[...]) et tokens FCM natifs
        $expoTokens = [];
        $fcmTokens  = [];

        foreach ($tokens as $token) {
            if (str_starts_with((string) $token, 'ExponentPushToken[')) {
                $expoTokens[] = $token;
            } else {
                $fcmTokens[] = $token;
            }
        }

        $sentAny  = false;
        $anyFailed = false;

        // ── Chemin A : Expo Push API (Expo Go + EAS, proxy FCM, gratuit) ──
        if (!empty($expoTokens)) {
            [$ok, $fail] = $this->sendViaExpoPush($expoTokens);
            $sentAny   = $sentAny  || $ok;
            $anyFailed = $anyFailed || $fail;
        }

        // ── Chemin B : FCM HTTP v1 directement (EAS build prod) ──────────
        if (!empty($fcmTokens)) {
            [$ok, $fail] = $this->sendViaFcmV1($fcmTokens);
            $sentAny   = $sentAny  || $ok;
            $anyFailed = $anyFailed || $fail;
        }

        NotificationLog::create([
            'ticket_id' => $this->data['ticket_id'] ?? null,
            'channel'   => 'push',
            'type'      => $this->data['type'] ?? 'generic',
            'status'    => $sentAny ? ($anyFailed ? 'partial' : 'sent') : 'failed',
            'payload'   => [
                'expo_tokens' => $expoTokens,
                'fcm_tokens'  => $fcmTokens,
                'title'       => $this->title,
                'body'        => $this->body,
                'data'        => $this->data,
            ],
            'sent_at' => $sentAny ? now() : null,
        ]);
    }

    /**
     * Envoie via l'API Expo Push (https://exp.host/--/api/v2/push/send).
     * Fonctionne en Expo Go et avec les builds EAS managées.
     * Complètement gratuit — Expo se charge du routage FCM/APNs.
     *
     * @param  string[]  $tokens
     * @return array{bool, bool}  [$sentAny, $anyFailed]
     */
    private function sendViaExpoPush(array $tokens): array
    {
        $client = new Client(['base_uri' => 'https://exp.host']);

        $messages = array_map(fn($t) => [
            'to'    => $t,
            'title' => $this->title,
            'body'  => $this->body,
            'data'  => $this->data,
            'sound' => 'default',
            'priority' => 'high',
        ], $tokens);

        try {
            $res  = $client->post('/--/api/v2/push/send', [
                'json'    => $messages,
                'headers' => ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
                'timeout' => 15,
            ]);
            $body = json_decode((string) $res->getBody(), true);

            $sentAny  = false;
            $anyFailed = false;
            foreach ((array) ($body['data'] ?? []) as $item) {
                if (($item['status'] ?? '') === 'ok') {
                    $sentAny = true;
                } else {
                    $anyFailed = true;
                    Log::warning('[Push] Expo token error', ['details' => $item]);

                    // Supprimer les tokens invalides / expirés
                    if (in_array($item['details']['error'] ?? '', ['DeviceNotRegistered', 'InvalidCredentials'])) {
                        $badToken = $item['details']['expoPushToken'] ?? null;
                        if ($badToken) {
                            Device::where('fcm_token', $badToken)->delete();
                        }
                    }
                }
            }

            Log::info('[Push] Expo send done', ['sent' => $sentAny, 'failed' => $anyFailed]);
            return [$sentAny, $anyFailed];
        } catch (\Throwable $e) {
            Log::error('[Push] Expo send exception: '.$e->getMessage());
            return [false, true];
        }
    }

    /**
     * Envoie via l'API FCM HTTP v1 directement (token natif Android/iOS).
     * Nécessite FIREBASE_SERVICE_ACCOUNT_JSON dans les variables d'env.
     *
     * @param  string[]  $tokens
     * @return array{bool, bool}  [$sentAny, $anyFailed]
     */
    private function sendViaFcmV1(array $tokens): array
    {
        $serviceAccountJson = config('services.firebase.service_account_json')
            ?? env('FIREBASE_SERVICE_ACCOUNT_JSON');

        if (!$serviceAccountJson) {
            Log::warning('[Push] FIREBASE_SERVICE_ACCOUNT_JSON non configuré ; push FCM ignoré');
            return [false, false];
        }

        $serviceAccount = json_decode($serviceAccountJson, true);
        if (!is_array($serviceAccount) || empty($serviceAccount['project_id'])) {
            Log::warning('[Push] FIREBASE_SERVICE_ACCOUNT_JSON invalide (project_id manquant)');
            return [false, true];
        }
        $projectId = (string) $serviceAccount['project_id'];

        // Obtenir un token OAuth2 via le compte de service
        $credentials = new ServiceAccountCredentials(
            ['https://www.googleapis.com/auth/firebase.messaging'],
            $serviceAccount
        );
        $tokenInfo   = $credentials->fetchAuthToken();
        $accessToken = $tokenInfo['access_token'] ?? null;

        if (!$accessToken) {
            Log::warning('[Push] Impossible d'obtenir un token Firebase');
            return [false, true];
        }

        $client    = new Client(['base_uri' => 'https://fcm.googleapis.com']);
        $url       = '/v1/projects/'.$projectId.'/messages:send';
        $sentAny   = false;
        $anyFailed = false;

        foreach ($tokens as $token) {
            try {
                $res    = $client->post($url, [
                    'headers' => [
                        'Authorization' => 'Bearer '.$accessToken,
                        'Content-Type'  => 'application/json; charset=UTF-8',
                    ],
                    'json' => [
                        'message' => [
                            'token'        => $token,
                            'notification' => ['title' => $this->title, 'body' => $this->body],
                            'data'         => array_map('strval', $this->data),
                            'android'      => ['priority' => 'high'],
                            'apns'         => ['headers' => ['apns-priority' => '10']],
                        ],
                    ],
                    'timeout' => 10,
                ]);
                $status  = $res->getStatusCode();
                $ok      = $status >= 200 && $status < 300;
                $sentAny = $sentAny || $ok;
                if (!$ok) {
                    $anyFailed = true;
                }
            } catch (\GuzzleHttp\Exception\ClientException $e) {
                $anyFailed = true;
                $body      = (string) $e->getResponse()->getBody();
                $decoded   = json_decode($body, true);
                $errCode   = $decoded['error']['details'][0]['errorCode'] ?? '';

                Log::error('[Push] FCM token error', ['code' => $errCode, 'token' => substr($token, 0, 20)]);

                // Supprimer les tokens invalides
                if (in_array($errCode, ['UNREGISTERED', 'INVALID_ARGUMENT'])) {
                    Device::where('fcm_token', $token)->delete();
                    Log::info('[Push] Token FCM invalide supprimé');
                }
            } catch (\Throwable $e) {
                $anyFailed = true;
                Log::error('[Push] FCM exception: '.$e->getMessage());
            }
        }

        return [$sentAny, $anyFailed];
    }
}
