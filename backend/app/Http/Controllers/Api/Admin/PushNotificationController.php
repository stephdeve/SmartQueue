<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SendPushNotification;
use App\Models\NotificationLog;
use App\Models\User;
use App\Notifications\AdminBroadcastNotification;
use Illuminate\Http\Request;

class PushNotificationController extends Controller
{
    /**
     * Broadcast a push notification to all registered devices.
     *
     * This endpoint is intended for establishment admins to publish announcements
     * to all mobile app users.
     */
    public function broadcast(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'body' => ['required', 'string', 'max:500'],
            'data' => ['sometimes', 'array'],
        ]);

        $payload = is_array($data['data'] ?? null) ? $data['data'] : [];
        $payload['type'] = $payload['type'] ?? 'admin_broadcast';

        // Destinataires : le personnel de l'établissement + ses usagers. Les usagers n'ont
        // pas d'establishment_id : ce sont ceux qui ont un ticket sur un service de
        // l'établissement (30 derniers jours) ou qui l'ont mis en favori.
        $admin = $request->user();
        $establishmentId = (int) ($admin->establishment_id ?? 0);
        $serviceIds = \App\Models\Service::query()->where('establishment_id', $establishmentId)->pluck('id');

        $audience = User::query()
            ->where(function ($q) use ($establishmentId, $serviceIds) {
                $q->where('establishment_id', $establishmentId)
                  ->orWhereHas('favoriteEstablishments', fn ($f) => $f->where('establishments.id', $establishmentId))
                  ->orWhereIn('id', \App\Models\Ticket::query()
                      ->select('user_id')
                      ->whereIn('service_id', $serviceIds)
                      ->whereNotNull('user_id')
                      ->where('created_at', '>=', now()->subDays(30)));
            });

        $establishmentUsers = (clone $audience)->get();

        // La cloche/dashboard affiche le broadcast pour toute l'audience…
        foreach ($establishmentUsers as $u) {
            $u->notify(new AdminBroadcastNotification($data['title'], $data['body'], $payload));
        }

        // …et l'envoi push reste limité aux users ayant au moins un device push_enabled
        $pushUserIds = (clone $audience)
            ->whereHas('devices', function ($q) {
                $q->where('push_enabled', true);
            })
            ->pluck('id')
            ->all();

        foreach ($pushUserIds as $userId) {
            // La notification in-app vient d'être créée ci-dessus : pas de doublon
            dispatch(new SendPushNotification((int) $userId, $data['title'], $data['body'], $payload, storeInApp: false));
        }

        NotificationLog::create([
            'ticket_id' => null,
            'channel' => 'push',
            'type' => $payload['type'] ?? 'admin_broadcast',
            'status' => 'queued',
            'payload' => [
                'title' => $data['title'],
                'body' => $data['body'],
                'data' => $payload,
                'establishment_users_notified' => $establishmentUsers->count(),
                'push_users_targeted' => count($pushUserIds),
            ],
            'sent_at' => null,
        ]);

        return response()->json([
            'message' => 'Broadcast queued',
            'establishment_users_notified' => $establishmentUsers->count(),
            'push_users_targeted' => count($pushUserIds),
        ]);
    }
}
