<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Service;
use App\Models\Ticket;
use App\Services\TicketService;

class AgentTicketController extends Controller
{
    /**
     * Appelle le prochain ticket prêt pour un service.
     */
    public function callNext(Service $service, TicketService $svc)
    {
        // Autorisation: rôle agent/admin (via middleware) + policy manage sur le service si besoin
        $this->authorize('manage', $service);
        $ticket = $svc->callNext($service);
        if (!$ticket) {
            return response()->json(['message' => 'No eligible ticket'], 204);
        }
        return response()->json(['called_ticket' => [
            'id' => $ticket->id,
            'number' => $ticket->number,
            'status' => $ticket->status,
        ]]);
    }

    /** Marque un ticket comme absent. */
    public function markAbsent(Ticket $ticket, TicketService $svc)
    {
        $this->authorize('actOn', $ticket);
        $ticket = $svc->markAbsent($ticket);
        return response()->json(['ticket' => [
            'id' => $ticket->id,
            'status' => $ticket->status,
        ]]);
    }

    /** Rappelle un ticket (status=called). */
    public function recall(Ticket $ticket, TicketService $svc)
    {
        $this->authorize('actOn', $ticket);
        $ticket = $svc->recall($ticket);
        return response()->json(['ticket' => [
            'id' => $ticket->id,
            'status' => $ticket->status,
        ]]);
    }
}
