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

        try {
            $ticket = $svc->close($ticket);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['ticket' => [
            'id' => $ticket->id,
            'status' => $ticket->status,
        ]]);
    }

    public function cancel(Ticket $ticket, TicketService $svc)
    {
        $this->authorize('actOn', $ticket);

        try {
            $ticket = $svc->cancel($ticket);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['ticket' => [
            'id' => $ticket->id,
            'status' => $ticket->status,
        ]]);
    }

    /**
     * Marque un ticket comme absent — système à deux niveaux :
     *   Niveau 1 : absence temporaire, rappel possible.
     *   Niveau 2 : absence définitive avec expiration automatique programmée.
     */
    public function markAbsent(Request $request, Ticket $ticket, TicketService $svc)
    {
        $this->authorize('actOn', $ticket);

        try {
            $ticket = $svc->markAbsent($ticket);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        $absenceLevel = (int) ($ticket->absent_level ?? 1);
        $maxAttempts  = (int) ($ticket->service?->max_call_attempts ?? 2);
        $recallPossible = $absenceLevel < $maxAttempts;

        return response()->json([
            'ticket' => [
                'id'             => $ticket->id,
                'status'         => $ticket->status,
                'absent_level'   => $absenceLevel,
                'deferral_count' => $ticket->deferral_count,
                'recall_possible'=> $recallPossible,
                'absent_expires_at' => $ticket->absent_expires_at?->toIso8601String(),
            ],
            'absent_level'   => $absenceLevel,
            'recall_possible'=> $recallPossible,
            'max_call_attempts' => $maxAttempts,
            'message'        => $recallPossible
                ? 'Absence temporaire — rappel possible.'
                : 'Absence définitive — ticket clôturé, rappel impossible.',
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
            'priority' => ['required','in:normal,high,vip,urgence'],
        ]);

        $ticket = $svc->setPriority($ticket, $data['priority']);

        return response()->json(['ticket' => [
            'id' => $ticket->id,
            'priority' => $ticket->priority,
        ]]);
    }
}