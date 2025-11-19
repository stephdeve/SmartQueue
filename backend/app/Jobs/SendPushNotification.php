<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;
use App\Models\Device;
use App\Models\NotificationLog;

class SendPushNotification implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $userId, public string $title, public string $body, public array $data = []) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $serverKey = env('FCM_SERVER_KEY');
        if (!$serverKey) {
            Log::warning('FCM_SERVER_KEY not configured; skipping push');
            return;
        }

        $tokens = Device::query()
            ->where('user_id', $this->userId)
            ->where('push_enabled', true)
            ->pluck('fcm_token')
            ->all();
        if (empty($tokens)) {
            Log::info('No device tokens for user '.$this->userId);
            return;
        }

        $client = new Client(['base_uri' => 'https://fcm.googleapis.com']);
        $payload = [
            'registration_ids' => array_values($tokens),
            'notification' => [
                'title' => $this->title,
                'body' => $this->body,
            ],
            'data' => $this->data,
        ];

        try {
            $res = $client->post('/fcm/send', [
                'headers' => [
                    'Authorization' => 'key='.$serverKey,
                    'Content-Type' => 'application/json',
                ],
                'json' => $payload,
                'timeout' => 10,
            ]);
            $status = $res->getStatusCode();
            NotificationLog::create([
                'ticket_id' => $this->data['ticket_id'] ?? null,
                'channel' => 'push',
                'type' => $this->data['type'] ?? 'generic',
                'status' => $status === 200 ? 'sent' : 'failed',
                'payload' => $payload,
                'sent_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::error('FCM send error: '.$e->getMessage());
            NotificationLog::create([
                'ticket_id' => $this->data['ticket_id'] ?? null,
                'channel' => 'push',
                'type' => $this->data['type'] ?? 'generic',
                'status' => 'failed',
                'payload' => $payload,
                'sent_at' => null,
            ]);
        }
    }
}
