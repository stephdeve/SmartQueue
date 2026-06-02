<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\Service;
use App\Services\AlertService;
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

        // Can only recall once
        if ($ticket->has_recalled) {
            return response()->json([
                'error' => 'Le rappel a déjà été utilisé',
            ], 400);
        }

        // Mark as recalled and reset called_at for new countdown
        $ticket->update([
            'has_recalled' => true,
            'called_at' => now(), // Reset countdown
        ]);

        // Send push + SMS notification
        $this->alertService->sendRecallNotification($ticket);

        return response()->json([
            'data' => $ticket->fresh(),
            'message' => 'Rappel envoyé',
            'countdown_seconds' => config('queue.call_timeout_seconds', 180),
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

        if (isset($validated['lat'], $validated['lng'])) {
            $travelMinutes = $this->alertService->calculateTravelTime(
                $validated['lat'],
                $validated['lng'],
                $ticket->service->establishment->lat,
                $ticket->service->establishment->lng,
                $request->user()->alertPreference?->preferred_transport_mode ?? 'motorcycle'
            );

            // Update user's last known location
            $ticket->update([
                'last_lat' => $validated['lat'],
                'last_lng' => $validated['lng'],
            ]);
        }

        $graceMinutes = (int) config('queue.en_route_grace_minutes', 10);

        // Mark as en route
        $ticket->update([
            'status' => 'en_route',
            'en_route_at' => $ticket->en_route_at ?? now(),
            'response_received_at' => now(),
            'en_route_expires_at' => now()->addMinutes($graceMinutes),
            'estimated_travel_minutes' => $travelMinutes,
        ]);

        // Test Reverb connectivity before dispatching
        $reverbHost = config('broadcasting.connections.pusher.options.host');
        $reverbPort = config('broadcasting.connections.pusher.options.port', 443);
        $reverbScheme = config('broadcasting.connections.pusher.options.scheme', 'https');

        \Log::info('[TicketRecallController] Broadcasting config', [
            'connection' => config('broadcasting.default'),
            'reverb_host' => $reverbHost,
            'reverb_port' => $reverbPort,
            'reverb_scheme' => $reverbScheme,
            'app_id' => config('broadcasting.connections.pusher.app_id'),
            'key_exists' => !empty(config('broadcasting.connections.pusher.key')),
            'secret_exists' => !empty(config('broadcasting.connections.pusher.secret')),
        ]);

        // Broadcast to agent dashboard via service channel
        \Log::info('UserEnRoute event dispatching', [
            'ticket_id' => $ticket->id,
            'service_id' => $ticket->service_id,
            'ticket_number' => $ticket->number,
            'estimated_minutes' => $travelMinutes,
        ]);

        try {
            event(new UserEnRoute(
                $ticket->id,
                $ticket->service_id,
                $travelMinutes,
                $ticket->number,
                $travelMinutes === null
            ));
            \Log::info('[TicketRecallController] UserEnRoute event dispatched successfully');
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
                    $agent->notify(new InAppNotification(
                        'Usager en route',
                        $message,
                        'user_en_route',
                        [
                            'ticket_id' => $ticket->id,
                            'ticket_number' => $ticket->number,
                            'service_id' => $ticket->service_id,
                            'estimated_minutes' => $travelMinutes,
                        ]
                    ));

                    // Also push a notification to agent device
                    try {
                        dispatch(new SendPushNotification(
                            $agent->id,
                            "Usager en route - {$ticket->number}",
                            $message,
                            [
                                'ticket_id' => $ticket->id,
                                'service_id' => $ticket->service_id,
                                'type' => 'user_en_route',
                            ]
                        ));
                    } catch (\Exception $_e) {
                        \Log::warning('[TicketRecallController] Failed to push to agent: ' . $_e->getMessage());
                    }
                }
                \Log::info('[TicketRecallController] Notifications created for agents', [
                    'agent_count' => $agents->count(),
                    'service_id' => $ticket->service_id,
                ]);
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
     * User confirms they are physically present.
     */
    public function present(Request $request, Ticket $ticket): JsonResponse
    {
        if ($ticket->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if (!in_array($ticket->status, ['en_route', 'called'], true)) {
            return response()->json([
                'error' => 'Le ticket ne peut pas être marqué présent',
            ], 400);
        }

        $ticket->update([
            'status' => 'present',
            'present_at' => now(),
            'response_received_at' => $ticket->response_received_at ?? now(),
        ]);

        // Broadcast updates to keep mobile and agent UI in sync
        try {
            // Private ticket channel update
            event(new \App\Events\TicketUpdated($ticket->id, [
                'status' => $ticket->status,
                'position' => null,
                'eta_minutes' => null,
            ]));

            // Private user channel update
            event(new \App\Events\UserTicketUpdated($ticket->user_id, [
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'status' => $ticket->status,
                'position' => null,
                'eta_minutes' => null,
            ]));

            // Notify agents via presence channel that the user is present
            event(new \App\Events\UserEnRoute(
                $ticket->id,
                $ticket->service_id,
                null,
                $ticket->number,
                true // confirmedPresence
            ));

            // Create in-app notifications for agents
            $service = \App\Models\Service::find($ticket->service_id);
            if ($service) {
                $agents = $service->agents()->get();
                foreach ($agents as $agent) {
                    $agent->notify(new \App\Notifications\InAppNotification(
                        'Usager présent',
                        "L'usager est présent au guichet (Ticket {$ticket->number})",
                        'user_present',
                        [
                            'ticket_id' => $ticket->id,
                            'ticket_number' => $ticket->number,
                            'service_id' => $ticket->service_id,
                        ]
                    ));

                    try {
                        dispatch(new SendPushNotification(
                            $agent->id,
                            "Usager présent - {$ticket->number}",
                            "L'usager du ticket {$ticket->number} est présent au guichet.",
                            [
                                'ticket_id' => $ticket->id,
                                'service_id' => $ticket->service_id,
                                'type' => 'user_present',
                            ]
                        ));
                    } catch (\Exception $_e) {
                        \Log::warning('[TicketRecallController] Failed to push present to agent: ' . $_e->getMessage());
                    }
                }
            }
        } catch (\Exception $e) {
            \Log::error('[TicketRecallController] present - broadcast/notify failed: '. $e->getMessage());
        }

        return response()->json([
            'data' => $ticket->fresh(),
            'message' => 'Présence confirmée',
        ]);
    }

    /**
     * User defers their ticket - swap position with next person in queue.
     * Can only be done once per ticket (called status only).
     */
    public function defer(Request $request, Ticket $ticket, \App\Services\TicketService $svc): JsonResponse
    {
        // Authorize: only ticket owner can defer
        if ($ticket->user_id !== $request->user()->id) {
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

        $timeoutSeconds = config('queue.call_timeout_seconds', 180);
        $calledAt = $ticket->called_at ?? now();
        $elapsed = now()->diffInSeconds($calledAt);
        $remaining = max(0, $timeoutSeconds - $elapsed);

        return response()->json([
            'is_called' => $ticket->status === 'called',
            'is_en_route' => $ticket->status === 'en_route',
            'is_present' => $ticket->status === 'present',
            'countdown_seconds' => $remaining,
            'has_recalled' => $ticket->has_recalled,
            'counter_number' => $ticket->counter?->number,
            'en_route_expires_at' => $ticket->en_route_expires_at,
        ]);
    }
}
