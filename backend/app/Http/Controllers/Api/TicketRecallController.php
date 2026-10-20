<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\Service;
use App\Services\TicketService;
use App\Services\AlertService;
use App\Events\TicketUpdated;
use App\Events\UserTicketUpdated;
use App\Events\UserEnRoute;
use App\Notifications\InAppNotification;
use App\Jobs\SendPushNotification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Notification;

class TicketRecallController extends Controller
{
    protected AlertService $alertService;

    public function __construct(AlertService $alertService)
    {
        $this->alertService = $alertService;
    }

    /**
     * User requests a recall (seconde chance).
     * Sends push + SMS, resets countdown once.
     */
    public function recall(Request $request, Ticket $ticket): JsonResponse
    {
        // Authorize: only ticket owner can recall
        if ($ticket->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Can only recall if ticket is called or en route
        if (!in_array($ticket->status, ['called', 'en_route'], true)) {
            return response()->json([
                'error' => 'Le ticket n\'est pas en statut appelé',
            ], 400);
        }

        // Cannot recall a definitively absent ticket
        if (($ticket->absent_level ?? 0) >= (int) ($ticket->service?->max_call_attempts ?? 2)) {
            return response()->json([
                'error' => 'Le ticket est en absence définitive et ne peut plus être rappelé',
            ], 400);
        }

        // Can only recall once
        if ($ticket->has_recalled) {
            return response()->json([
                'error' => 'Le rappel a déjà été utilisé',
            ], 400);
        }

        $timeoutMinutes = max(1, $ticket->service?->call_timeout_minutes
            ?? (int) ceil((int) config('queue.call_timeout_seconds', 600) / 60));

        // Mark as recalled and reset countdown
        $ticket->update([
            'has_recalled' => true,
            'called_at' => now(),
            'called_expires_at' => now()->addMinutes($timeoutMinutes),
        ]);

        // Send push + SMS notification
        $this->alertService->sendRecallNotification($ticket);

        return response()->json([
            'data' => $ticket->fresh(),
            'message' => 'Rappel envoyé',
            'countdown_seconds' => $timeoutMinutes * 60,
        ]);
    }

    /**
     * Expire immédiatement un ticket en_route dont le délai est dépassé.
     * Appelé par le client mobile quand le palier de grâce local se termine.
     */
    public function expireEnRoute(Request $request, Ticket $ticket, TicketService $ticketService): JsonResponse
    {
        if ($ticket->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($ticket->status !== 'en_route') {
            return response()->json(['error' => 'Ticket not in en_route status'], 422);
        }

        $expiresAt = $ticket->en_route_expires_at;
        if (!$expiresAt || $expiresAt->isFuture()) {
            return response()->json(['error' => 'En route grace period has not expired yet'], 422);
        }

        try {
            $ticketService->markAbsent($ticket);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Ticket marqué absent suite au dépassement du délai de présentation.',
        ]);
    }

    /**
     * User confirms they are on their way.
     * Notifies agent with estimated travel time.
     */
    public function enRoute(Request $request, Ticket $ticket): JsonResponse
    {
        // Authorize: only ticket owner
        if ($ticket->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Can only confirm if ticket is called or already marked en route
        if (!in_array($ticket->status, ['called', 'en_route'], true)) {
            return response()->json([
                'error' => 'Le ticket n\'est pas en statut appelé',
            ], 400);
        }

        $validated = $request->validate([
            'estimated_travel_minutes' => 'sometimes|integer|min:1|max:60',
            'lat' => 'sometimes|numeric',
            'lng' => 'sometimes|numeric',
        ]);

        // Calculate travel time if coordinates provided
        $travelMinutes = $validated['estimated_travel_minutes'] ?? null;

        $establishment = $ticket->service?->establishment;
        if (isset($validated['lat'], $validated['lng']) && $establishment?->lat !== null && $establishment?->lng !== null) {
            $travelMinutes = $this->alertService->calculateTravelTime(
                $validated['lat'],
                $validated['lng'],
                (float) $establishment->lat,
                (float) $establishment->lng,
                $request->user()->alertPreference?->preferred_transport_mode ?? 'motorcycle'
            );
            // Le mobile valide 1..60 min ; une distance très faible donne 0 min
            $travelMinutes = max(1, $travelMinutes);

        }
        if (isset($validated['lat'], $validated['lng'])) {
            // Update user's last known location
            $ticket->update([
                'last_lat' => $validated['lat'],
                'last_lng' => $validated['lng'],
            ]);
        }

        $graceMinutes = (int) ($ticket->service?->en_route_grace_minutes ?? config('queue.en_route_grace_minutes', 10));

        // Mark as en route
        $ticket->update([
            'status' => 'en_route',
            'en_route_at' => $ticket->en_route_at ?? now(),
            'response_received_at' => now(),
            'en_route_expires_at' => now()->addMinutes($graceMinutes),
            'estimated_travel_minutes' => $travelMinutes,
        ]);

        // Broadcast to agent dashboard via service channel
        try {
            event(new UserEnRoute(
                $ticket->id,
                $ticket->service_id,
                $travelMinutes,
                $ticket->number,
                $travelMinutes === null,
                $ticket->last_distance_m
            ));
        } catch (\Exception $e) {
            \Log::error('[TicketRecallController] Failed to dispatch UserEnRoute', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        // Create in-app notification for agents of the service
        try {
            $service = Service::find($ticket->service_id);
            if ($service) {
                $agents = $service->agents()->get();
                $message = $travelMinutes
                    ? "L'usager arrive dans ~{$travelMinutes} min (Ticket {$ticket->number})"
                    : "L'usager a confirmé sa présence (Ticket {$ticket->number})";

                foreach ($agents as $agent) {
                    // Push + notification in-app (créée par le job)
                    try {
                        dispatch(new SendPushNotification(
                            $agent->id,
                            "Usager en route - {$ticket->number}",
                            $message,
                            [
                                'ticket_id' => $ticket->id,
                                'ticket_number' => $ticket->number,
                                'service_id' => $ticket->service_id,
                                'estimated_minutes' => $travelMinutes,
                                'type' => 'user_en_route',
                            ]
                        ));
                    } catch (\Exception $_e) {
                        \Log::warning('[TicketRecallController] Failed to push to agent: ' . $_e->getMessage());
                    }
                }
            }
        } catch (\Exception $e) {
            \Log::error('[TicketRecallController] Failed to create agent notifications', [
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'data' => $ticket->fresh(),
            'message' => 'En route confirmé',
            'estimated_travel_minutes' => $travelMinutes,
            'grace_minutes' => $graceMinutes,
        ]);
    }

    /**
     * Usager confirme "Je suis déjà là" → clôture directe du ticket (auto-servi).
     *
     * L'agent n'a plus besoin de cliquer sur "Servi" manuellement :
     * le ticket passe à 'closed', la file est recalculée et l'agent est
     * notifié en temps réel via le canal de présence du service.
     */
    public function present(
        Request $request,
        Ticket $ticket,
        \App\Services\TicketService $ticketService
    ): JsonResponse {
        // Seul le propriétaire du ticket peut confirmer sa présence
        if ($ticket->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Ticket doit être dans un état "appelé"
        if (!in_array($ticket->status, ['called', 'en_route'], true)) {
            return response()->json([
                'error' => 'Le ticket n\'est pas en statut appelé',
            ], 422);
        }

        // ── Clôturer le ticket directement ────────────────────────────────────
        $ticket->update([
            'status'              => 'closed',
            'closed_at'          => now(),
            'present_at'         => now(),
            'response_received_at' => now(),
            'eta_minutes'        => null,
            'position'           => null,
        ]);

        $service = $ticket->service;

        try {
            // 1. Notifier l'usager (canal privé ticket)
            event(new \App\Events\TicketUpdated($ticket->id, [
                'status'      => 'closed',
                'self_served' => true,
                'closed_at'   => $ticket->closed_at,
            ]));

            // 2. Notifier l'usager (canal privé user)
            event(new \App\Events\UserTicketUpdated($ticket->user_id, [
                'ticket_id'   => $ticket->id,
                'service_id'  => $ticket->service_id,
                'status'      => 'closed',
                'self_served' => true,
            ]));

            // 3. Notifier les agents en temps réel (canal présence du service)
            //    → le dashboard agent se rafraîchit sans action manuelle
            event(new \App\Events\ServiceTicketServed($service->id, [
                'service_id'    => $service->id,
                'ticket_id'     => $ticket->id,
                'ticket_number' => $ticket->number,
                'self_served'   => true,
                'ticket' => [
                    'id'          => $ticket->id,
                    'number'      => $ticket->number,
                    'service_id'  => $service->id,
                    'self_served' => true,
                    'closed_at'   => $ticket->closed_at,
                ],
            ]));

            // 4. Notification in-app pour chaque agent du service
            $agents = $service->agents()->get();
            foreach ($agents as $agent) {
                // Push vers l'agent (async) + notification in-app créée par le job
                try {
                    dispatch(new SendPushNotification(
                        $agent->id,
                        "Ticket {$ticket->number} — auto-servi",
                        "L'usager est arrivé. Le ticket est clos automatiquement.",
                        ['ticket_id' => $ticket->id, 'ticket_number' => $ticket->number, 'service_id' => $ticket->service_id, 'type' => 'self_served']
                    ));
                } catch (\Exception $_e) {
                    \Log::warning('[present] push agent failed: ' . $_e->getMessage());
                }
            }

            // 5. Recalculer les positions de la file (ticket retiré)
            $ticketService->recomputePositions($service);

        } catch (\Exception $e) {
            \Log::error('[TicketRecallController] present - broadcast failed: ' . $e->getMessage());
            // On ne fait pas échouer la requête si le broadcast rate
        }

        return response()->json([
            'message'    => 'Présence confirmée. Votre ticket est clos.',
            'self_served' => true,
            'ticket' => [
                'id'        => $ticket->id,
                'status'    => 'closed',
                'closed_at' => $ticket->closed_at,
            ],
        ]);
    }

    /**
     * User defers their ticket - swap position with next person in queue.
     * Can only be done once per ticket (called status only).
     */
    public function defer(Request $request, Ticket $ticket, \App\Services\TicketService $svc): JsonResponse
    {
        // Même URI que l'action agent (POST tickets/{ticket}/defer) : la route usager,
        // déclarée en dernier, la remplaçait et renvoyait 403 aux agents.
        if ((int) $ticket->user_id !== (int) $request->user()->id) {
            if ($request->user()->can('actOn', $ticket)) {
                return app(AgentTicketActionController::class)->defer($request, $ticket, $svc);
            }
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Can only defer if ticket is called or en route
        if (!in_array($ticket->status, ['called', 'en_route'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Le ticket n\'est pas en statut appelé',
            ], 400);
        }

        // Check if already swapped (can only defer once)
        if ($ticket->is_swapped) {
            return response()->json([
                'success' => false,
                'message' => 'Vous avez déjà différé une fois. Vous ne pouvez plus échanger votre position.',
            ], 422);
        }

        // Check grace period (24h since original called or first call)
        $referenceTime = $ticket->original_called_at ?? $ticket->called_at;
        if ($referenceTime && \Illuminate\Support\Carbon::parse($referenceTime)->addHours(24)->isPast()) {
            return response()->json([
                'success' => false,
                'message' => 'La période de grâce de 24h est expirée, vous ne pouvez plus différer',
            ], 422);
        }

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
                'message' => 'Position échangée avec succès. Vous passez après la personne suivante.',
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('[TicketRecallController] defer failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de l\'échange de position',
            ], 500);
        }
    }

    /**
     * Get countdown status for a called ticket.
     */
    public function countdown(Request $request, Ticket $ticket): JsonResponse
    {
        if ($ticket->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if (!in_array($ticket->status, ['called', 'en_route', 'present'], true)) {
            return response()->json([
                'is_called' => false,
                'countdown_seconds' => 0,
            ]);
        }

        $service = $ticket->service;
        $timeoutMinutes = max(1, $service->call_timeout_minutes
            ?? (int) ceil((int) config('queue.call_timeout_seconds', 600) / 60));
        $timeoutSeconds = $timeoutMinutes * 60;

        // Use called_at-based elapsed time to avoid datetime second-truncation issues:
        // when called_expires_at is stored as datetime (no microseconds), now() can appear
        // later by <1s, causing diffInSeconds to return -1 → clamped to 0 → false "expiré".
        // NB: Carbon 3 diffInSeconds is SIGNED — compute elapsed in the calledAt→now
        // direction (positive) so remaining = timeout - elapsed, not timeout + elapsed.
        $calledAt = $ticket->called_at ?? $ticket->created_at;
        $elapsed = (int) $calledAt->diffInSeconds(now());
        $remaining = max(0, $timeoutSeconds - $elapsed);

        return response()->json([
            'is_called' => $ticket->status === 'called',
            'is_en_route' => $ticket->status === 'en_route',
            'is_present' => $ticket->status === 'present',
            'countdown_seconds' => (int) $remaining,
            'has_recalled' => $ticket->has_recalled,
            'counter_number' => $ticket->counter?->name,
            'en_route_expires_at' => $ticket->en_route_expires_at,
            'called_expires_at' => $ticket->called_expires_at,
            'call_timeout_minutes' => $timeoutMinutes,
        ]);
    }
}
