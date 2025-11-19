<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Device;

class DeviceController extends Controller
{
    /**
     * Enregistre ou met à jour un device FCM pour l'utilisateur courant.
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

        // Upsert basé sur le token + user_id
        $device = Device::updateOrCreate(
            ['user_id' => $request->user()->id, 'fcm_token' => $data['fcm_token']],
            [
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
