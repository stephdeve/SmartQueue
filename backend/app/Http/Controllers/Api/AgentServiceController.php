<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Events\ServiceConfigUpdated;
use App\Models\Service;

class AgentServiceController extends Controller
{
    use AuthorizesRequests;

    /**
     * Ouvre un service (autorise la création de nouveaux tickets).
     */
    public function open(Service $service)
    {
        $this->authorize('manage', $service);

        $service->status = 'open';
        $service->save();

        return response()->json(['message' => 'Service opened', 'service_id' => $service->id]);
    }

    /**
     * Met à jour les paramètres d'absence/délais d'un service depuis l'espace agent :
     *   - call_timeout_minutes  : délai de priorité (avant marquage absent automatique)
     *   - en_route_grace_minutes : délai de présentation après « Je suis en route »
     *   - max_call_attempts     : nombre d'absences avant expiration définitive
     *
     * Tous les champs sont optionnels — seuls ceux fournis sont mis à jour.
     */
    public function updateCallTimeout(Request $request, Service $service)
    {
        $this->authorize('manage', $service);

        $data = $request->validate([
            'call_timeout_minutes'   => ['sometimes', 'nullable', 'integer', 'min:1', 'max:60'],
            'en_route_grace_minutes' => ['sometimes', 'integer', 'min:1', 'max:60'],
            'max_call_attempts'      => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);

        if ($request->has('call_timeout_minutes')) {
            $service->call_timeout_minutes = $data['call_timeout_minutes'] ?? null;
        }
        if (array_key_exists('en_route_grace_minutes', $data)) {
            $service->en_route_grace_minutes = $data['en_route_grace_minutes'];
        }
        if (array_key_exists('max_call_attempts', $data)) {
            $service->max_call_attempts = $data['max_call_attempts'];
        }
        $service->save();

        // La configuration est déjà enregistrée : une panne du serveur WebSocket ne doit
        // pas transformer la requête en erreur 500.
        try {
            event(new ServiceConfigUpdated($service->id, [
                'service_id' => $service->id,
                'call_timeout_minutes' => $service->call_timeout_minutes,
                'en_route_grace_minutes' => (int) $service->en_route_grace_minutes,
                'max_call_attempts' => (int) $service->max_call_attempts,
            ]));
        } catch (\Throwable $e) {
            Log::warning('Broadcast ServiceConfigUpdated failed: '.$e->getMessage());
        }

        return response()->json([
            'message'                => 'Paramètres du service mis à jour',
            'service_id'             => $service->id,
            'call_timeout_minutes'   => $service->call_timeout_minutes,
            'en_route_grace_minutes' => (int) $service->en_route_grace_minutes,
            'max_call_attempts'      => (int) $service->max_call_attempts,
        ]);
    }

    /**
     * Ferme un service (empêche la création de nouveaux tickets).
     */
    public function close(Service $service)
    {
        // Vérifie que l'utilisateur agit en tant qu'agent/admin
        $this->authorize('manage', $service);

        $service->status = 'closed';
        $service->save();

        return response()->json(['message' => 'Service closed', 'service_id' => $service->id]);
    }
}
