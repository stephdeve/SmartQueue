<?php

namespace App\Services;

use App\Events\TicketCalled;
use App\Events\TicketUpdated;
use App\Events\UserTicketUpdated;
use App\Events\ServiceStatsUpdated;
use App\Events\ServiceTicketCalled;
use App\Events\ServiceTicketAbsent;
use App\Events\ServiceTicketEnqueued;
use App\Jobs\SendPushNotification;
use App\Jobs\SendSmsNotification;
use App\Models\Service;
use App\Models\Ticket;
use App\Models\User;
use App\Notifications\InAppNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;

class TicketService
{
    private const ACTIVE_STATUSES = ['waiting','called','en_route','present','absent'];

    /**
     * Broadcast event safely - logs error but doesn't crash on failure
     */
    private function broadcastSafely(callable $broadcastFn): void
    {
        try {
            $broadcastFn();
        } catch (\Exception $e) {
            Log::warning('Broadcast failed: ' . $e->getMessage());
            // Continue execution - don't let broadcast failures crash the API
        }
    }

    public function recomputePositions(Service $service): void
    {
        $waiting = Ticket::query()
            ->where('service_id', $service->id)
            ->where('status', 'waiting')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get(['id', 'user_id', 'position', 'eta_minutes']);

        $pos = 1;
        foreach ($waiting as $t) {
            $eta = $this->estimateWaitTime($service, new Ticket(['position' => $pos]));
            $positionChanged = (int) $t->position !== $pos;
            $etaChanged = (int) ($t->eta_minutes ?? -1) !== $eta;

            // Mettre à jour la DB uniquement si quelque chose a changé
            if ($positionChanged || $etaChanged) {
                Ticket::query()->where('id', $t->id)->update([
                    'position' => $pos,
                    'eta_minutes' => $eta,
                ]);
            }

            // Toujours broadcaster la position et l'ETA pour que le mobile reste
            // synchronisé, même si la position numérique n'a pas changé.
            // Cas typique : un ticket est servi, les positions restent identiques
            // mais l'ETA recalculé est différent — sans cet événement le mobile
            // affiche un ETA figé.
            $this->broadcastSafely(fn() => event(new TicketUpdated($t->id, [
                'position' => $pos,
                'eta_minutes' => $eta,
            ])));
            $this->broadcastSafely(fn() => event(new UserTicketUpdated($t->user_id, [
                'ticket_id' => $t->id,
                'position' => $pos,
                'eta_minutes' => $eta,
            ])));

            $pos++;
        }

        $waitingCount = $pos - 1;
        $this->broadcastSafely(fn() => event(new ServiceStatsUpdated($service->id, ['waiting_count' => $waitingCount])));
    }

    /**
     * Crée un ticket pour un service donné avec logique de position et numérotation.
     */
    public function createTicket(User $user, int $serviceId, ?float $lat = null, ?float $lng = null, ?string $fromQr = null): Ticket
    {
        $this->expireOldTicketsForServiceId($serviceId);

        $attempts = 0;
        $maxAttempts = 5;

        while (true) {
            $attempts++;

            try {
                return DB::transaction(function () use ($user, $serviceId, $lat, $lng) {
                    // Verrouille le service pour sérialiser les créations simultanées
                    // et garantir des positions/numéros uniques et cohérents.
                    $service = Service::query()
                        ->whereKey($serviceId)
                        ->lockForUpdate()
                        ->firstOrFail();

            // Vérifier que le service est ouvert
            if ($service->status !== 'open') {
                abort(422, 'Service is closed');
            }

            // Vérifier la capacité max de la file (si définie)
            if (!is_null($service->capacity)) {
                $waitingCount = Ticket::query()
                    ->where('service_id', $serviceId)
                    ->where('status', 'waiting')
                    ->count();
                if ($waitingCount >= (int) $service->capacity) {
                    abort(422, 'Service queue is full');
                }
            }

            // Empêcher plusieurs tickets actifs pour le même service et utilisateur
            $already = Ticket::query()
                ->where('user_id', $user->id)
                ->where('service_id', $serviceId)
                ->whereIn('status', ['waiting','called','en_route','present','absent'])
                ->exists();
            if ($already) {
                abort(422, 'You already have an active ticket for this service');
            }

            // Génération d'un numéro lisible (jour + incrément local au service)
            $prefix = strtoupper(substr($service->name, 0, 1));
            $today = Carbon::now()->format('Ymd');
            $last = Ticket::query()
                ->where('service_id', $serviceId)
                ->whereDate('created_at', Carbon::today())
                ->orderByDesc('id')
                ->value('number');
            $seq = 1;
            if ($last && preg_match('/^[A-Z]-(\d+)-'.$today.'$/', $last, $m)) {
                $seq = ((int) $m[1]) + 1;
            }
            $number = sprintf('%s-%03d-%s', $prefix, $seq, $today);

            // Position = nombre de waiting actuelle + 1
            $position = Ticket::query()
                ->where('service_id', $serviceId)
                ->where('status', 'waiting')
                ->count() + 1;

                    $ticket = Ticket::create([
                        'user_id' => $user->id,
                        'service_id' => $serviceId,
                        'number' => $number,
                        'status' => 'waiting',
                        'priority' => 'normal',
                        'position' => $position,
                        'source' => 'app',
                        'valid_date' => Carbon::today()->toDateString(),
                        'last_distance_m' => $this->estimateDistanceMeters($lat, $lng, $service),
                        'last_seen_at' => Carbon::now(),
                    ]);

            // Calculate initial ETA and persist it
            $eta = $this->estimateWaitTime($service, $ticket);
            $ticket->update(['eta_minutes' => $eta]);

            // Broadcast mise à jour initiale
            $this->broadcastSafely(fn() => event(new TicketUpdated($ticket->id, [
                'status' => $ticket->status,
                'position' => $ticket->position,
                'eta_minutes' => $eta,
            ])));

            $this->broadcastSafely(fn() => event(new UserTicketUpdated($user->id, [
                'ticket_id' => $ticket->id,
                'service_id' => $service->id,
                'status' => $ticket->status,
                'number' => $ticket->number,
                'position' => $ticket->position,
                'eta_minutes' => $eta,
            ])));

            // Diffusion sur le canal de présence du service: nouveau ticket en file
            $this->broadcastSafely(fn() => event(new ServiceTicketEnqueued($service->id, [
                'service_id' => $service->id,
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->number,
                'priority' => $ticket->priority,
                'ticket' => [
                    'id' => $ticket->id,
                    'number' => $ticket->number,
                    'priority' => $ticket->priority,
                ]
            ])));

            // Mise à jour des stats de file
            $this->recomputePositions($service);

                    return $ticket->fresh(['service.establishment']);
                });
            } catch (QueryException $e) {
                $isUniqueViolation = ($e->getCode() === '23000');
                if ($isUniqueViolation && $attempts < $maxAttempts) {
                    usleep(50000);
                    continue;
                }
                throw $e;
            }
        }
    }

    /**
     * Crée un ticket via scan QR code.
     * Le ticket est valable uniquement pour la journée en cours.
     */
    public function createForQrScan(Service $service, User $user): Ticket
    {
        $this->expireOldTicketsForService($service);

        return DB::transaction(function () use ($service, $user) {
            // Verrouille le service pour éviter les collisions de numérotation et
            // de position lors de scans QR simultanés.
            $service = Service::query()
                ->whereKey($service->id)
                ->lockForUpdate()
                ->firstOrFail();

            // Vérifier que le service est ouvert
            if ($service->status !== 'open') {
                abort(422, 'Service is closed');
            }

            // Génération d'un numéro lisible
            $prefix = strtoupper(substr($service->name, 0, 1));
            $today = Carbon::now()->format('Ymd');
            $last = Ticket::query()
                ->where('service_id', $service->id)
                ->whereDate('created_at', Carbon::today())
                ->orderByDesc('id')
                ->value('number');
            $seq = 1;
            if ($last && preg_match('/^[A-Z]-(\d+)-'.$today.'$/', $last, $m)) {
                $seq = ((int) $m[1]) + 1;
            }
            $number = sprintf('%s-%03d-%s', $prefix, $seq, $today);

            // Position = nombre de waiting actuelle + 1
            $position = Ticket::query()
                ->where('service_id', $service->id)
                ->where('status', 'waiting')
                ->count() + 1;

            $ticket = Ticket::create([
                'user_id' => $user->id,
                'service_id' => $service->id,
                'number' => $number,
                'status' => 'waiting',
                'priority' => $user->priority ?? 'normal',
                'position' => $position,
                'source' => 'qr_scan',
                'valid_date' => Carbon::today()->toDateString(),
                'last_seen_at' => Carbon::now(),
            ]);

            // Calculate initial ETA and persist it
            $eta = $this->estimateWaitTime($service, $ticket);
            $ticket->update(['eta_minutes' => $eta]);

            // Broadcast mise à jour initiale
            $this->broadcastSafely(fn() => event(new TicketUpdated($ticket->id, [
                'status' => $ticket->status,
                'position' => $ticket->position,
                'eta_minutes' => $eta,
            ])));

            $this->broadcastSafely(fn() => event(new UserTicketUpdated($user->id, [
                'ticket_id' => $ticket->id,
                'service_id' => $service->id,
                'status' => $ticket->status,
                'number' => $ticket->number,
                'position' => $ticket->position,
                'eta_minutes' => $eta,
            ])));

            // Diffusion sur le canal de présence du service
            $this->broadcastSafely(fn() => event(new ServiceTicketEnqueued($service->id, [
                'service_id' => $service->id,
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->number,
                'priority' => $ticket->priority,
                'ticket' => [
                    'id' => $ticket->id,
                    'number' => $ticket->number,
                    'priority' => $ticket->priority,
                ]
            ])));

            $this->recomputePositions($service);

            return $ticket->fresh(['service.establishment']);
        });
    }

    /**
     * Estime le temps d'attente pour un ticket donné.
     * Strategy: dynamic (24h history) if enough samples, else static (configured avg).
     */
    public function estimateWaitTime(Service $service, Ticket $ticket): int
    {
        $waitingAhead = max(0, ($ticket->position ?? 1) - 1);
        $avgTime = $this->estimateAvgServiceTimeMinutes($service->id, $service->avg_service_time_minutes ?? 5);

        return (int) ($waitingAhead * $avgTime);
    }

    /**
     * Calculate average service time from last 24h of closed tickets.
     * Returns dynamic average if >= 10 samples, else falls back to configured value.
     */
    private function estimateAvgServiceTimeMinutes(int $serviceId, int $fallback): int
    {
        $rows = DB::table('tickets')
            ->where('service_id', $serviceId)
            ->whereNotNull('closed_at')
            ->whereNotNull('called_at')
            ->where('closed_at', '>=', now()->subDay())
            ->select(['called_at', 'closed_at'])
            ->limit(300)
            ->get();

        $sum = 0;
        $n = 0;
        foreach ($rows as $r) {
            $called = Carbon::parse($r->called_at);
            $closed = Carbon::parse($r->closed_at);
            if ($closed->greaterThan($called)) {
                $sum += $closed->diffInMinutes($called);
                $n++;
            }
        }

        if ($n >= 10) {
            return (int) max(1, (int) round($sum / $n));
        }

        return (int) max(1, $fallback);
    }

    /**
     * Appelle le prochain ticket prêt pour un service (priorité > ancienneté).
     */
    public function callNext(Service $service, ?int $counterId = null): ?Ticket
    {
        return DB::transaction(function () use ($service, $counterId) {
            $this->expireOldTicketsForService($service);

            // Priorité stricte :
            // 1) ticket présent sur place
            // 2) ticket appelé classique
            // 3) prochain ticket en attente
            $ticket = Ticket::query()
                ->where('service_id', $service->id)
                ->whereIn('status', ['present', 'called', 'waiting'])
                ->whereDate('valid_date', Carbon::today())
                ->orderByRaw("CASE status WHEN 'present' THEN 1 WHEN 'called' THEN 2 ELSE 3 END")
                ->orderByRaw("CASE priority WHEN 'vip' THEN 3 WHEN 'high' THEN 2 ELSE 1 END DESC")
                ->orderBy('position')
                ->orderBy('created_at')
                ->lockForUpdate()
                ->first();

            if (!$ticket) {
                return null;
            }

            $wasPresent = $ticket->status === 'present';

            $ticket->status = 'called';
            if (!$wasPresent) {
                $ticket->en_route_at = null; // Nouvel appel : l'utilisateur n'a pas encore répondu
                $ticket->present_at = null;
                $ticket->response_received_at = null;
                $ticket->en_route_expires_at = null;
            }
            if (!is_null($counterId)) {
                $ticket->counter_id = $counterId;
            }
            $ticket->called_at = Carbon::now();
            $ticket->position = null;
            $ticket->eta_minutes = 0; // Called = no more waiting
            $ticket->save();

            // Diffusion: ticket appelé
            $this->broadcastSafely(fn() => event(new TicketCalled($ticket->id, [
                'ticket_id' => $ticket->id,
                'number' => $ticket->number,
                'counter_id' => $ticket->counter_id,
                'service_id' => $service->id,
                'position' => null,
            ])));
            $this->broadcastSafely(fn() => event(new TicketUpdated($ticket->id, [
                'status' => $ticket->status,
                'position' => null,
                'eta_minutes' => 0,
            ])));

            if ($ticket->user) {
                $this->broadcastSafely(fn() => event(new UserTicketUpdated($ticket->user->id, [
                    'ticket_id' => $ticket->id,
                    'service_id' => $service->id,
                    'status' => $ticket->status,
                    'number' => $ticket->number,
                    'counter_id' => $ticket->counter_id,
                    'position' => null,
                    'eta_minutes' => 0,
                ])));
            }

            // Diffusion service: ticket appelé
            $this->broadcastSafely(fn() => event(new ServiceTicketCalled($service->id, [
                'service_id' => $service->id,
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->number,
                'ticket' => [
                    'id' => $ticket->id,
                    'number' => $ticket->number,
                ]
            ])));

            // Notifications push & SMS (asynchrones via queue)
            if ($ticket->user) {
                dispatch(new SendPushNotification($ticket->user->id, $wasPresent ? 'Vous êtes prioritaire' : 'Vous êtes appelé', $wasPresent ? 'Votre présence a été enregistrée. Présentez-vous immédiatement au guichet.' : 'Présentez-vous au guichet', [
                    'ticket_id' => $ticket->id,
                    'service_id' => $service->id,
                ]));
                if (!empty($ticket->user->phone)) {
                    dispatch(new SendSmsNotification($ticket->user->phone, 'Vous êtes appelé pour le ticket '.$ticket->number, [
                        'ticket_id' => $ticket->id,
                    ]));
                }
            }

            // Recalcul des positions restantes
            $this->recomputePositions($service);

            return $ticket->fresh(['service.establishment']);
        });
    }

    /**
     * Marque un ticket absent et notifie.
     */
    public function markAbsent(Ticket $ticket): Ticket
    {
        $this->expireOldTicketsForServiceId($ticket->service_id);

        $ticket->status = 'absent';
        $ticket->absent_at = Carbon::now();
        $ticket->en_route_expires_at = null;
        $ticket->position = null;
        $ticket->eta_minutes = null; // No longer in queue
        $ticket->save();

        $this->broadcastSafely(fn() => event(new TicketUpdated($ticket->id, [
            'status' => $ticket->status,
            'position' => null,
            'eta_minutes' => null,
        ])));

        if ($ticket->user) {
            $this->broadcastSafely(fn() => event(new UserTicketUpdated($ticket->user->id, [
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'status' => $ticket->status,
                'position' => null,
                'eta_minutes' => null,
            ])));

            // Send push notification for absent
            dispatch(new SendPushNotification($ticket->user->id, 'Ticket marqué absent', 'Vous avez été marqué absent pour le ticket '.$ticket->number, [
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'type' => 'absent',
            ]));
        }

        // Diffusion service: ticket marqué absent
        $this->broadcastSafely(fn() => event(new ServiceTicketAbsent($ticket->service_id, [
            'service_id' => $ticket->service_id,
            'ticket_id' => $ticket->id,
            'ticket_number' => $ticket->number,
            'ticket' => [
                'id' => $ticket->id,
                'number' => $ticket->number,
            ]
        ])));

        if ($ticket->user && !empty($ticket->user->phone)) {
            dispatch(new SendSmsNotification($ticket->user->phone, 'Vous avez été marqué absent pour le ticket '.$ticket->number));
        }

        $this->recomputePositions($ticket->service);
        return $ticket->fresh();
    }

    /**
     * Clôture un ticket (service rendu) et notifie l'usager.
     *
     * Diffuse les mêmes événements temps réel que markAbsent/cancel afin que
     * l'app mobile reflète immédiatement le passage à "servi" sur tous les
     * écrans (sinon le ticket restait affiché "en cours" jusqu'à un refresh).
     */
    public function close(Ticket $ticket): Ticket
    {
        $ticket->status = 'closed';
        $ticket->closed_at = Carbon::now();
        $ticket->en_route_expires_at = null;
        $ticket->position = null;
        $ticket->eta_minutes = null;
        $ticket->save();

        $this->broadcastSafely(fn() => event(new TicketUpdated($ticket->id, [
            'status' => $ticket->status,
            'position' => null,
            'eta_minutes' => null,
        ])));

        if ($ticket->user) {
            $this->broadcastSafely(fn() => event(new UserTicketUpdated($ticket->user->id, [
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'status' => $ticket->status,
                'position' => null,
                'eta_minutes' => null,
            ])));

            dispatch(new SendPushNotification($ticket->user->id, 'Service terminé', 'Votre ticket '.$ticket->number.' a été servi. Merci !', [
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'type' => 'served',
            ]));
        }

        $this->recomputePositions($ticket->service);
        return $ticket->fresh();
    }

    /**
     * Met à jour la priorité d'un ticket et notifie en temps réel.
     */
    public function setPriority(Ticket $ticket, string $priority): Ticket
    {
        $ticket->priority = $priority;
        $ticket->save();

        $this->broadcastSafely(fn() => event(new TicketUpdated($ticket->id, [
            'status'   => $ticket->status,
            'priority' => $ticket->priority,
        ])));

        if ($ticket->user) {
            $this->broadcastSafely(fn() => event(new UserTicketUpdated($ticket->user->id, [
                'ticket_id'  => $ticket->id,
                'service_id' => $ticket->service_id,
                'status'     => $ticket->status,
                'priority'   => $ticket->priority,
            ])));
        }

        $this->recomputePositions($ticket->service);
        return $ticket->fresh();
    }

    /**
     * Défère un ticket appelé : échange sa position avec le ticket suivant.
     * Le ticket déferré redevient "waiting" avec la position du suivant.
     * Le ticket suivant est appelé à la place.
     * Valable pendant 24h après l'appel original.
     */
    public function deferCalledTicket(Ticket $ticket): ?Ticket
    {
        $this->expireOldTicketsForServiceId($ticket->service_id);

        // Vérifier que le ticket est bien appelé
        if (!in_array($ticket->status, ['called', 'en_route'], true)) {
            throw new \InvalidArgumentException('Ticket must be called or en route to defer');
        }

        // Vérifier la période de grâce (24h depuis appel original ou premier appel)
        $referenceTime = $ticket->original_called_at ?? $ticket->called_at;
        if ($referenceTime && Carbon::parse($referenceTime)->addHours(24)->isPast()) {
            throw new \InvalidArgumentException('Grace period expired, cannot defer');
        }

        return DB::transaction(function () use ($ticket) {
            $service = $ticket->service;

            // Trouver le prochain ticket waiting après celui-ci
            // If the current ticket has no numeric position (e.g. already null when called),
            // fall back to selecting the earliest waiting ticket. Avoids SQL errors like
            // "operator does not exist" when comparing with NULL on some DB drivers.
            $query = Ticket::query()
                ->where('service_id', $service->id)
                ->where('status', 'waiting');

            if (is_numeric($ticket->position)) {
                $query->where('position', '>', $ticket->position)
                      ->orderBy('position');
            } else {
                // No position on the called ticket - pick the earliest waiting ticket
                $query->orderBy('position');
            }

            $nextTicket = $query->orderBy('created_at')
                ->lockForUpdate()
                ->first();

            // Si pas de ticket suivant, on ne peut pas déférer
            if (!$nextTicket) {
                return null;
            }

            // Sauvegarder les positions originales
            $ticketOriginalPosition = $ticket->position;
            $nextTicketPosition = $nextTicket->position;

            // Le ticket déferré prend la position du suivant
            $ticket->position = $nextTicketPosition;
            $ticket->status = 'waiting';
            $ticket->en_route_expires_at = null;
            $ticket->deferred_at = Carbon::now();
            $ticket->deferral_count = ($ticket->deferral_count ?? 0) + 1;
            $ticket->is_swapped = true;
            $ticket->swapped_with_ticket_id = $nextTicket->id;
            if (!$ticket->original_called_at) {
                $ticket->original_called_at = $ticket->called_at;
            }
            $ticket->grace_period_expires_at = Carbon::parse($ticket->original_called_at)->addHours(24);
            $ticket->called_at = null;
            $ticket->counter_id = null;
            $ticket->eta_minutes = $this->estimateWaitTime($service, $ticket);
            $ticket->save();

            // Le ticket suivant est appelé à la place
            $nextTicket->position = null;
            $nextTicket->status = 'called';
            $nextTicket->en_route_at = null; // Nouvel appel : pas encore de réponse
            $nextTicket->present_at = null;
            $nextTicket->response_received_at = null;
            $nextTicket->en_route_expires_at = null;
            $nextTicket->called_at = Carbon::now();
            $nextTicket->is_swapped = true;
            $nextTicket->swapped_with_ticket_id = $ticket->id;
            $nextTicket->eta_minutes = 0;
            $nextTicket->save();

            // Notifications
            if ($nextTicket->user) {
                dispatch(new SendPushNotification(
                    $nextTicket->user->id,
                    "C'est votre tour !",
                    'Le ticket précédent est absent. Présentez-vous au guichet.',
                    ['ticket_id' => $nextTicket->id, 'service_id' => $service->id, 'swapped' => true]
                ));
            }

            if ($ticket->user) {
                dispatch(new SendPushNotification(
                    $ticket->user->id,
                    'Ticket différé',
                    'Vous avez été recalé en position ' . $ticket->position . '. Vous avez 24h pour vous présenter.',
                    ['ticket_id' => $ticket->id, 'service_id' => $service->id, 'deferred' => true]
                ));
            }

            // Notify agents in-app that a user chose to defer
            try {
                $agents = $service->agents()->get();
                foreach ($agents as $agent) {
                    $agent->notify(new InAppNotification(
                        'Usager a laissé passer',
                        "L'usager du ticket {$ticket->number} a choisi de laisser passer son tour.",
                        'user_deferred',
                        [
                            'ticket_id' => $ticket->id,
                            'ticket_number' => $ticket->number,
                            'service_id' => $service->id,
                        ]
                    ));

                    // Also send a push notification to agents if they have devices
                    try {
                        dispatch(new SendPushNotification(
                            $agent->id,
                            "Usager laissé passer - {$ticket->number}",
                            "L'usager du ticket {$ticket->number} a choisi de laisser passer son tour.",
                            [
                                'ticket_id' => $ticket->id,
                                'service_id' => $service->id,
                                'type' => 'user_deferred',
                            ]
                        ));
                    } catch (\Exception $_e) {
                        Log::warning('Failed to dispatch push to agent: ' . $_e->getMessage());
                    }
                }
            } catch (\Exception $e) {
                Log::warning('Failed to notify agents about defer: ' . $e->getMessage());
            }

            // Événements
            $this->broadcastSafely(fn() => event(new TicketUpdated($ticket->id, [
                'status' => 'waiting',
                'position' => $ticket->position,
                'eta_minutes' => $ticket->eta_minutes,
                'is_swapped' => true,
                'deferred_at' => $ticket->deferred_at,
            ])));
            $this->broadcastSafely(fn() => event(new TicketUpdated($nextTicket->id, [
                'status' => 'called',
                'position' => null,
                'eta_minutes' => 0,
                'is_swapped' => true,
            ])));

            if ($ticket->user) {
                $this->broadcastSafely(fn() => event(new UserTicketUpdated($ticket->user->id, [
                    'ticket_id' => $ticket->id,
                    'service_id' => $service->id,
                    'status' => 'waiting',
                    'position' => $ticket->position,
                    'eta_minutes' => $ticket->eta_minutes,
                    'deferred' => true,
                ])));
            }

            if ($nextTicket->user) {
                $this->broadcastSafely(fn() => event(new UserTicketUpdated($nextTicket->user->id, [
                    'ticket_id' => $nextTicket->id,
                    'service_id' => $service->id,
                    'status' => 'called',
                    'position' => null,
                    'eta_minutes' => 0,
                    'swapped' => true,
                ])));
            }

            return $ticket->fresh();
        });
    }

    /**
     * Version améliorée de markAbsent qui tente d'abord de déférer le ticket
     * pendant la période de grâce de 24h.
     */
    public function markAbsentWithDeferral(Ticket $ticket): Ticket
    {
        $this->expireOldTicketsForServiceId($ticket->service_id);

        // Vérifier si on peut déférer (période de grâce de 24h)
        $referenceTime = $ticket->original_called_at ?? $ticket->called_at;
        $canDefer = in_array($ticket->status, ['called', 'en_route'], true) &&
                    $referenceTime &&
                    !Carbon::parse($referenceTime)->addHours(24)->isPast();

        if ($canDefer) {
            // Essayer de déférer (catch exceptions pour fallback)
            try {
                $deferred = $this->deferCalledTicket($ticket);
                if ($deferred) {
                    return $deferred;
                }
            } catch (\Exception $e) {
                // Si erreur lors du défert, on continue vers markAbsent normal
                \Log::warning('Failed to defer ticket, falling back to markAbsent', [
                    'ticket_id' => $ticket->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Fallback : marquer absent classiquement
        return $this->markAbsent($ticket);
    }

    /**
     * Annule un ticket par l'utilisateur.
     */
    public function cancel(Ticket $ticket): Ticket
    {
        $ticket->status = 'canceled';
        $ticket->position = null;
        $ticket->eta_minutes = null;
        $ticket->save();
        $this->broadcastSafely(fn() => event(new TicketUpdated($ticket->id, [
            'status' => $ticket->status,
            'position' => null,
            'eta_minutes' => null,
        ])));

        if ($ticket->user) {
            $this->broadcastSafely(fn() => event(new UserTicketUpdated($ticket->user->id, [
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'status' => $ticket->status,
                'position' => null,
                'eta_minutes' => null,
            ])));
        }
        $this->recomputePositions($ticket->service);
        return $ticket->fresh();
    }

    /**
     * Rappelle un ticket (repasse en called si toujours éligible).
     */
    public function recall(Ticket $ticket): Ticket
    {
        $this->expireOldTicketsForServiceId($ticket->service_id);

        $ticket->status = 'called';
        $ticket->en_route_at = null; // Rappel : réinitialise la réponse précédente
        $ticket->present_at = null;
        $ticket->response_received_at = null;
        $ticket->en_route_expires_at = null;
        $ticket->called_at = Carbon::now();
        $ticket->position = null;
        $ticket->eta_minutes = 0; // Called = no more waiting
        $ticket->save();
        $this->broadcastSafely(fn() => event(new TicketCalled($ticket->id, [
            'ticket_id' => $ticket->id,
            'number' => $ticket->number,
            'counter_id' => $ticket->counter_id,
            'service_id' => $ticket->service_id,
            'position' => null,
        ])));
        $this->broadcastSafely(fn() => event(new TicketUpdated($ticket->id, [
            'status' => $ticket->status,
            'position' => null,
            'eta_minutes' => 0,
        ])));
        $this->broadcastSafely(fn() => event(new ServiceTicketCalled($ticket->service_id, [
            'service_id' => $ticket->service_id,
            'ticket_id' => $ticket->id,
            'ticket_number' => $ticket->number,
            'ticket' => [
                'id' => $ticket->id,
                'number' => $ticket->number,
            ]
        ])));

        if ($ticket->user) {
            $this->broadcastSafely(fn() => event(new UserTicketUpdated($ticket->user->id, [
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'status' => $ticket->status,
                'number' => $ticket->number,
                'counter_id' => $ticket->counter_id,
                'position' => null,
                'eta_minutes' => 0,
            ])));

            // Send push notification for recall
            dispatch(new SendPushNotification($ticket->user->id, 'Rappel - Votre ticket est appelé', 'Présentez-vous au guichet pour le ticket '.$ticket->number, [
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'type' => 'recall',
            ]));

            // Send SMS if phone available
            if (!empty($ticket->user->phone)) {
                dispatch(new SendSmsNotification($ticket->user->phone, 'Rappel: Votre ticket '.$ticket->number.' est appelé. Présentez-vous au guichet.', [
                    'ticket_id' => $ticket->id,
                ]));
            }
        }
        return $ticket->fresh();
    }

    /**
     * Estimation simple de la distance (mètres) entre l'utilisateur et l'établissement du service.
     * Utilise Haversine approximatif si lat/lng fournis et si le service a des coordonnées via son établissement.
     */
    private function estimateDistanceMeters(?float $lat, ?float $lng, Service $service): ?int
    {
        $est = $service->establishment;
        if ($lat === null || $lng === null || !$est || $est->lat === null || $est->lng === null) {
            return null;
        }
        $earth = 6371000; // m
        $dLat = deg2rad($est->lat - $lat);
        $dLng = deg2rad($est->lng - $lng);
        $a = sin($dLat/2) * sin($dLat/2) + cos(deg2rad($lat)) * cos(deg2rad($est->lat)) * sin($dLng/2) * sin($dLng/2);
        $c = 2 * atan2(sqrt($a), sqrt(1-$a));
        return (int) round($earth * $c);
    }

    private function expireOldTicketsForServiceId(int $serviceId): void
    {
        $service = Service::query()->find($serviceId);
        if (!$service) return;
        $this->expireOldTicketsForService($service);
    }

    private function expireOldTicketsForService(Service $service): void
    {
        $now = Carbon::now();
        $today = $now->format('Y-m-d');
        $closingTime = $service->closing_time ?? '18:00:00';

        // 1) Expire tickets whose valid_date is strictly before today
        //    (yesterday's tickets should already be gone)
        $updated = Ticket::query()
            ->where('service_id', $service->id)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->whereNotNull('valid_date')
            ->whereDate('valid_date', '<', $today)
            ->update([
                'status' => 'expired',
                'position' => null,
                'eta_minutes' => null,
                'updated_at' => Carbon::now(),
            ]);

        // 2) Expire today's tickets if the service closing time has passed
        $todayClosing = Carbon::createFromFormat(
            'Y-m-d H:i:s',
            $today . ' ' . $closingTime
        );

        if ($now->isAfter($todayClosing)) {
            $updated += Ticket::query()
                ->where('service_id', $service->id)
                ->whereIn('status', self::ACTIVE_STATUSES)
                ->whereDate('valid_date', $today)
                ->update([
                    'status' => 'expired',
                    'position' => null,
                    'eta_minutes' => null,
                    'updated_at' => Carbon::now(),
                ]);
        }

        // 3) Safety net: expire tickets with no valid_date older than 24h
        $cutoff24h = $now->copy()->subHours(24);
        $updated += Ticket::query()
            ->where('service_id', $service->id)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->whereNull('valid_date')
            ->where('created_at', '<', $cutoff24h)
            ->update([
                'status' => 'expired',
                'position' => null,
                'eta_minutes' => null,
                'updated_at' => Carbon::now(),
            ]);

        if ($updated > 0) {
            $this->recomputePositions($service);
        }
    }
}
