<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Service;

class AgentServiceController extends Controller
{
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
