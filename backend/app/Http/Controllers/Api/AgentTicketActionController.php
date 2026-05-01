<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Http\Request;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

class AgentTicketActionController extends Controller
{
    use AuthorizesRequests;
    public function close(Ticket $ticket, TicketService $svc)
    {
        $this->authorize('actOn', $ticket);

        $ticket->status = 'closed';
        $ticket->closed_at = now();
        $ticket->eta_minutes = null;
        $ticket->save();

        $svc->recomputePositions($ticket->service);

        return response()->json(['ticket' => [
            'id' => $ticket->id,
            'status' => $ticket->status,
        ]]);
    }

    public function cancel(Ticket $ticket, TicketService $svc)
    {
        $this->authorize('actOn', $ticket);

        $ticket = $svc->cancel($ticket);

        return response()->json(['ticket' => [
            'id' => $ticket->id,
            'status' => $ticket->status,
        ]]);
    }

    /**
     * Marque un ticket comme absent avec tentative de déférer automatiquement.
     * Si le ticket est dans la période de grâce (24h), il échangera sa position
     * avec le ticket suivant au lieu d'être marqué absent.
     */
    public function markAbsent(Request $request, Ticket $ticket, TicketService $svc)
    {
        $this->authorize('actOn', $ticket);

        $data = $request->validate([
            'force_absent' => 'boolean',
        ]);

        // Si force_absent est true, on marque absent directement sans déférer
        if ($data['force_absent'] ?? false) {
            $ticket = $svc->markAbsent($ticket);
            return response()->json([
                'ticket' => [
                    'id' => $ticket->id,
                    'status' => $ticket->status,
                    'absent_at' => $ticket->absent_at,
                ],
                'deferred' => false,
                'message' => 'Ticket marqué absent',
            ]);
        }

        // Sinon, essayer de déférer d'abord
        $ticket = $svc->markAbsentWithDeferral($ticket);

        $wasDeferred = $ticket->is_swapped && $ticket->status === 'waiting';

        return response()->json([
            'ticket' => [
                'id' => $ticket->id,
                'status' => $ticket->status,
                'position' => $ticket->position,
                'is_swapped' => $ticket->is_swapped,
                'deferred_at' => $ticket->deferred_at,
                'grace_period_expires_at' => $ticket->grace_period_expires_at,
            ],
            'deferred' => $wasDeferred,
            'message' => $wasDeferred 
                ? 'Ticket différé : position échangée avec le suivant. 24h pour se présenter.' 
                : 'Ticket marqué absent',
        ]);
    }

    /**
     * Défère explicitement un ticket appelé.
     * Échange sa position avec le ticket suivant dans la file.
     */
    public function defer(Request $request, Ticket $ticket, TicketService $svc)
    {
        $this->authorize('actOn', $ticket);

        try {
            $deferredTicket = $svc->deferCalledTicket($ticket);

            if (!$deferredTicket) {
                return response()->json([
                    'success' => false,
                    'message' => 'Aucun ticket suivant disponible pour l\'échange',
                ], 422);
            }

            return response()->json([
                'success' => true,
                'ticket' => [
                    'id' => $deferredTicket->id,
                    'status' => $deferredTicket->status,
                    'position' => $deferredTicket->position,
                    'is_swapped' => $deferredTicket->is_swapped,
                    'deferred_at' => $deferredTicket->deferred_at,
                    'grace_period_expires_at' => $deferredTicket->grace_period_expires_at,
                ],
                'message' => 'Ticket différé avec succès. Position échangée avec le suivant.',
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    public function setPriority(Request $request, Ticket $ticket, TicketService $svc)
    {
        $this->authorize('actOn', $ticket);

        $data = $request->validate([
            'priority' => ['required','in:normal,high,vip'],
        ]);

        $ticket->priority = $data['priority'];
        $ticket->save();

        $svc->recomputePositions($ticket->service);

        return response()->json(['ticket' => [
            'id' => $ticket->id,
            'priority' => $ticket->priority,
        ]]);
    }
}
