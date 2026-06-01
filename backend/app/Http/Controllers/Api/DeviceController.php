<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Device;

class DeviceController extends Controller
{
    /**
     * Enregistre ou met à jour un device FCM pour l'utilisateur courant.
     *
     * Correction : un token FCM est unique par device physique. Si ce token
     * appartient déjà à un autre utilisateur (ex : même téléphone, compte
     * différent), on le réassigne à l'utilisateur courant pour éviter que
     * les notifications d'un utilisateur soient envoyées à un autre.
     */
    public function register(Request $request)
    {
        $data = $request->validate([
            'fcm_token' => ['required','string'],
            'platform' => ['nullable','in:android,ios,web'],
            'app_version' => ['nullable','string','max:32'],
            'push_enabled' => ['nullable','boolean'],
            'sms_enabled' => ['nullable','boolean'],
        ]);

        $currentUserId = $request->user()->id;

        // Supprimer ce token s'il est associé à un autre utilisateur.
        // Un token FCM est lié au device physique, pas au compte — si l'utilisateur
        // change de compte sur le même téléphone, l'ancien propriétaire ne doit
        // plus recevoir les notifications de ce device.
        Device::where('fcm_token', $data['fcm_token'])
            ->where('user_id', '!=', $currentUserId)
            ->delete();

        // Upsert basé sur le token (maintenant unique) pour l'utilisateur courant
        $device = Device::updateOrCreate(
            ['fcm_token' => $data['fcm_token']],
            [
                'user_id' => $currentUserId,
                'platform' => $data['platform'] ?? null,
                'app_version' => $data['app_version'] ?? null,
                'push_enabled' => $data['push_enabled'] ?? true,
                'sms_enabled' => $data['sms_enabled'] ?? false,
            ]
        );

        return response()->json([
            'message' => 'Device registered',
            'device_id' => $device->id,
        ]);
    }
}
