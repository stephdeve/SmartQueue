<?php

namespace App\Services;

use App\Events\TicketCalled;
use App\Events\TicketUpdated;
use App\Events\UserTicketUpdated;
use App\Events\ServiceStatsUpdated;
use App\Events\ServiceTicketCalled;
use App\Events\ServiceTicketAbsent;
use App\Events\ServiceTicketEnqueued;
use App\Events\ServiceTicketServed;
use App\Events\TicketLifecycle\TicketCreated as TicketLifecycleCreated;
use App\Jobs\SendPushNotification;
use App\Jobs\SendSmsNotification;
use App\Models\Service;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;

class TicketService
{
    private const ACTIVE_STATUSES = ['waiting','called','en_route','present','absent'];

    public function __construct(
        private readonly ?ServiceAvailabilityService $availability = null,
        private readonly ?SmartQueueEngine $smartQueue = null,
    ) {
    }

    private function availability(): ServiceAvailabilityService
    {
        return $this->availability ?? app(ServiceAvailabilityService::class);
    }

    private function smartQueue(): SmartQueueEngine
    {
        return $this->smartQueue ?? app(SmartQueueEngine::class);
    }

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
        $mode = $service->priority_mode ?? 'immediate';
        $ratio = max(1, (int) ($service->priority_weighted_ratio ?? 5));

        $baseQuery = Ticket::query()
            ->where('service_id', $service->id)
            ->where('status', 'waiting')
            ->whereDate('valid_date', Carbon::today());

        if ($mode === 'disabled') {
            // Pure FIFO — urgence still first, everything else by arrival
            $waiting = (clone $baseQuery)
                ->orderByRaw("CASE priority WHEN 'urgence' THEN 0 ELSE 1 END")
                ->orderBy('created_at')
                ->orderBy('id')
                ->get(['id', 'user_id', 'position', 'eta_minutes', 'priority']);
        } elseif ($mode === 'weighted') {
            // Fetch by arrival, then interleave in PHP
            $all = (clone $baseQuery)
                ->orderBy('created_at')
                ->orderBy('id')
                ->get(['id', 'user_id', 'position', 'eta_minutes', 'priority']);

            $urgence   = $all->filter(fn($t) => $t->priority === 'urgence')->values();
            $prios     = $all->filter(fn($t) => in_array($t->priority, ['vip', 'high']))->values();
            $normal    = $all->filter(fn($t) => !in_array($t->priority, ['urgence', 'vip', 'high']))->values();
            $waiting   = $urgence->concat($this->weightedInterleave($normal, $prios, $ratio));
        } else {
            // IMMEDIATE (default) — strict priority order: urgence > vip > high > normal
            $waiting = (clone $baseQuery)
                ->orderByRaw("CASE priority WHEN 'urgence' THEN 0 WHEN 'vip' THEN 1 WHEN 'high' THEN 2 ELSE 3 END")
                ->orderBy('created_at')
                ->orderBy('id')
                ->get(['id', 'user_id', 'position', 'eta_minutes', 'priority']);
        }

        // Durée moyenne calculée une seule fois pour toute la file (évite N requêtes)
        $avgTime = $this->estimateAvgServiceTimeMinutes($service->id, $service->avg_service_time_minutes ?? 5);

        $pos = 1;
        foreach ($waiting as $t) {
            $eta = (int) (($pos - 1) * $avgTime);
            $positionChanged = (int) $t->position !== $pos;
            $etaChanged = (int) ($t->eta_minutes ?? -1) !== $eta;

            if (!$positionChanged && !$etaChanged) {
                $pos++;
                continue;
            }

            Ticket::query()->where('id', $t->id)->update([
                'position' => $pos,
                'eta_minutes' => $eta,
            ]);

            // Diffuser dès que la position OU l'ETA change (ex: ticket servi →
            // positions identiques mais ETA recalculé). Les tickets inchangés ne
            // sont pas re-diffusés : chaque diffusion est un appel HTTP synchrone
            // vers Reverb, exécuté pendant que la file est verrouillée.
            $this->broadcastSafely(fn() => event(new TicketUpdated($t->id, [
                'position' => $pos,
                'eta_minutes' => $eta,
            ])));
            // Tickets créés par un agent n'ont pas de user_id — pas de canal user.*
            if ($t->user_id !== null) {
                $this->broadcastSafely(fn() => event(new UserTicketUpdated($t->user_id, [
                    'ticket_id' => $t->id,
                    'position' => $pos,
                    'eta_minutes' => $eta,
                ])));
            }

            $pos++;
        }

        $waitingCount = $pos - 1;
        $this->broadcastSafely(fn() => event(new ServiceStatsUpdated($service->id, ['waiting_count' => $waitingCount])));
    }

    /**
     * Interleave normal and priority tickets: every $ratio normal → 1 priority.
     */
    private function weightedInterleave($normal, $priorities, int $ratio)
    {
        $result     = collect();
        $pi         = 0;
        $ni         = 0;
        $normalCount = 0;
        $pCount     = $priorities->count();
        $nCount     = $normal->count();

        while ($ni < $nCount || $pi < $pCount) {
            if ($pi < $pCount && $normalCount >= $ratio) {
                $result->push($priorities[$pi++]);
                $normalCount = 0;
            } elseif ($ni < $nCount) {
                $result->push($normal[$ni++]);
                $normalCount++;
            } else {
                $result->push($priorities[$pi++]);
            }
        }

        return $result;
    }

    /**
     * Prochain numéro lisible pour un service et un jour cible : "A-001-20260101".
     *
     * Le préfixe est la première lettre ASCII du nom du service ("État civil" → "E",
     * "1er guichet" → "E", "123" → "T") : un octet isolé d'un caractère multi-octets produirait un
     * UTF-8 invalide (rejeté par PostgreSQL), et un préfixe non alphabétique empêchait
     * de relire la séquence (toujours 001 → violation d'unicité dès le 2e ticket).
     * Doit être appelé sous verrou du service (lockForUpdate).
     */
    public function nextTicketNumber(Service $service, string $targetDate): string
    {
        $ascii = strtoupper(\Illuminate\Support\Str::ascii((string) $service->name));
        $prefix = preg_match('/[A-Z]/', $ascii, $letter) ? $letter[0] : 'T';
        $targetDateKey = str_replace('-', '', $targetDate);

        $numbers = Ticket::query()
            ->where('service_id', $service->id)
            ->whereDate('valid_date', $targetDate)
            ->pluck('number');

        $seq = 0;
        foreach ($numbers as $number) {
            if (preg_match('/-(\d+)-'.$targetDateKey.'$/', (string) $number, $m)) {
                $seq = max($seq, (int) $m[1]);
            }
        }

        return sprintf('%s-%03d-%s', $prefix, $seq + 1, $targetDateKey);
    }

    /**
     * Vérifie qu'un usager peut prendre un ticket sur ce service (capacité + doublon).
     */
    private function assertCanEnqueue(Service $service, User $user, string $targetDate): void
    {
        // Capacité: appliquée uniquement à la file active du jour cible.
        if (!is_null($service->capacity)) {
            $waitingCount = Ticket::query()
                ->where('service_id', $service->id)
                ->where('status', 'waiting')
                ->whereDate('valid_date', $targetDate)
                ->count();
            if ($waitingCount >= (int) $service->capacity) {
                abort(422, 'Service queue is full');
            }
        }

        if ($this->findActiveTicketFor($service->id, $user->id)) {
            abort(422, 'You already have an active ticket for this service');
        }
    }

    /**
     * Ticket encore actif (aujourd'hui ou reporté) d'un usager sur un service.
     * Les absents définitifs (absent_expires_at renseigné) ne bloquent pas un nouveau ticket.
     */
    public function findActiveTicketFor(int $serviceId, int $userId): ?Ticket
    {
        return Ticket::query()
            ->where('user_id', $userId)
            ->where('service_id', $serviceId)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->where(function ($q) {
                $q->whereNull('absent_expires_at')
                  ->orWhere('status', '!=', 'absent');
            })
            ->whereDate('valid_date', '>=', Carbon::today())
            ->orderByDesc('id')
            ->first();
    }

    /** Code SQLSTATE de violation d'unicité : MySQL/SQLite = 23000, PostgreSQL = 23505. */
    private function isUniqueViolation(QueryException $e): bool
    {
        return in_array((string) $e->getCode(), ['23000', '23505'], true);
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

            // SmartQueueEngine: décide entre file active du jour ou file différée.
            // Aborte si le service est manuellement fermé (override admin).
            $placement = $this->smartQueue()->decidePlacement($service, Carbon::now());
            $isDeferred = $placement['mode'] === 'deferred';
            $targetDate = $placement['valid_date'];

            $this->assertCanEnqueue($service, $user, $targetDate);

            // Génération d'un numéro lisible (jour cible + incrément local au service)
            $number = $this->nextTicketNumber($service, $targetDate);

            // Position = rang dans la file du jour cible
            $position = Ticket::query()
                ->where('service_id', $serviceId)
                ->where('status', 'waiting')
                ->whereDate('valid_date', $targetDate)
                ->count() + 1;

                    $ticket = Ticket::create([
                        'user_id' => $user->id,
                        'service_id' => $serviceId,
                        'number' => $number,
                        'status' => 'waiting',
                        'priority' => 'normal',
                        'position' => $position,
                        'source' => 'app',
                        'valid_date' => $targetDate,
                        'auto_deferred' => $isDeferred,
                        'defer_reason' => $placement['reason'],
                        'last_distance_m' => $this->estimateDistanceMeters($lat, $lng, $service),
                        'last_seen_at' => Carbon::now(),
                    ]);

            // ETA only meaningful for today's active queue. Deferred tickets show as "reported".
            $eta = $isDeferred ? null : $this->estimateWaitTime($service, $ticket);
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
            // (uniquement pour les tickets actifs du jour; les différés ne modifient pas la file en cours)
            if (!$isDeferred) {
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

                // Mise à jour des stats de file actives
                $this->recomputePositions($service);
            }

            // Événement de cycle de vie → listener envoie une notification adaptée
            event(new TicketLifecycleCreated(
                ticketId: $ticket->id,
                isDeferred: $isDeferred,
                deferReason: $placement['reason'],
            ));

                    return $ticket->fresh(['service.establishment']);
                });
            } catch (QueryException $e) {
                if ($this->isUniqueViolation($e) && $attempts < $maxAttempts) {
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

            // SmartQueueEngine: décide entre file active du jour ou file différée.
            $placement = $this->smartQueue()->decidePlacement($service, Carbon::now());
            $isDeferred = $placement['mode'] === 'deferred';
            $targetDate = $placement['valid_date'];

            $this->assertCanEnqueue($service, $user, $targetDate);

            // Génération d'un numéro lisible (jour cible)
            $number = $this->nextTicketNumber($service, $targetDate);

            // Position = rang dans la file du jour cible
            $position = Ticket::query()
                ->where('service_id', $service->id)
                ->where('status', 'waiting')
                ->whereDate('valid_date', $targetDate)
                ->count() + 1;

            $ticket = Ticket::create([
                'user_id' => $user->id,
                'service_id' => $service->id,
                'number' => $number,
                'status' => 'waiting',
                'priority' => 'normal',
                'position' => $position,
                'source' => 'qr_scan',
                'valid_date' => $targetDate,
                'auto_deferred' => $isDeferred,
                'defer_reason' => $placement['reason'],
                'last_seen_at' => Carbon::now(),
            ]);

            // ETA only meaningful for today's active queue.
            $eta = $isDeferred ? null : $this->estimateWaitTime($service, $ticket);
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

            // Diffusion sur le canal de présence du service (uniquement pour les tickets actifs du jour)
            if (!$isDeferred) {
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
            }

            // Événement de cycle de vie → listener envoie une notification adaptée
            event(new TicketLifecycleCreated(
                ticketId: $ticket->id,
                isDeferred: $isDeferred,
                deferReason: $placement['reason'],
            ));

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
                // Carbon 3 : $a->diffInMinutes($b) est signé (positif si $b > $a)
                $sum += $called->diffInMinutes($closed);
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
            // 2) prochain ticket en attente
            // Un ticket déjà « called » est en cours de traitement à un guichet : le
            // reprendre ici ferait appeler deux fois la même personne (et bloquerait
            // la file tant qu'il n'est pas clôturé/absent). Il est géré par
            // recall / markAbsent / close ou l'expiration automatique.
            $ticket = Ticket::query()
                ->where('service_id', $service->id)
                ->whereIn('status', ['present', 'waiting'])
                ->whereDate('valid_date', Carbon::today())
                ->orderByRaw("CASE status WHEN 'present' THEN 1 ELSE 2 END")
                ->orderByRaw("CASE priority WHEN 'urgence' THEN 4 WHEN 'vip' THEN 3 WHEN 'high' THEN 2 ELSE 1 END DESC")
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
            $timeoutMinutes = max(1, $service->call_timeout_minutes
                ?? (int) ceil((int) config('queue.call_timeout_seconds', 600) / 60));
            $ticket->called_expires_at = Carbon::now()->addMinutes($timeoutMinutes);
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
                'status'           => $ticket->status,
                'position'         => null,
                'eta_minutes'      => 0,
                'called_expires_at' => $ticket->called_expires_at->toIso8601String(),
                'deferral_count'   => $ticket->deferral_count ?? 0,
            ])));

            if ($ticket->user) {
                $this->broadcastSafely(fn() => event(new UserTicketUpdated($ticket->user->id, [
                    'ticket_id'        => $ticket->id,
                    'service_id'       => $service->id,
                    'status'           => $ticket->status,
                    'number'           => $ticket->number,
                    'counter_id'       => $ticket->counter_id,
                    'position'         => null,
                    'eta_minutes'      => 0,
                    'called_expires_at' => $ticket->called_expires_at->toIso8601String(),
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
                dispatch(new SendPushNotification(
                    $ticket->user->id,
                    $wasPresent ? 'Vous êtes prioritaire' : 'Vous êtes appelé',
                    $wasPresent
                        ? 'Votre présence a été enregistrée. Présentez-vous immédiatement au guichet.'
                        : 'Présentez-vous au guichet',
                    [
                        'type'       => 'ticket_called',
                        'ticket_id'  => $ticket->id,
                        'service_id' => $service->id,
                    ]
                ));
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
     * Marque un ticket absent avec système à deux niveaux :
     *   Niveau 1 — absence temporaire, rappel possible, ticket conservé dans la file.
     *   Niveau 2 — absence définitive, expiration automatique programmée, ticket retiré à expiration.
     */
    public function markAbsent(Ticket $ticket): Ticket
    {
        $this->expireOldTicketsForServiceId($ticket->service_id);

        $ticket->refresh();
        if (!in_array($ticket->status, self::ACTIVE_STATUSES, true)) {
            throw new \InvalidArgumentException('Ce ticket est déjà terminé.');
        }

        $service = $ticket->service;
        $maxAttempts = (int) ($service?->max_call_attempts ?? 2);

        // Ne bloquer QUE les tickets déjà en absence définitive (niveau >= max).
        // Un ticket en absence temporaire (niveau < max) doit pouvoir être escaladé
        // au niveau supérieur — c'est exactement ce que fait le bouton « Absent définitif ».
        if ($ticket->status === 'absent' && (int) ($ticket->absent_level ?? 0) >= $maxAttempts) {
            return $ticket;
        }

        $currentLevel = (int) ($ticket->absent_level ?? 0);
        $newLevel = $currentLevel + 1;
        $ticket->absent_level = $newLevel;
        $ticket->deferral_count = ($ticket->deferral_count ?? 0) + 1;
        $ticket->en_route_expires_at = null;
        $ticket->called_expires_at = null;
        $ticket->position = null;
        $ticket->eta_minutes = null;

        $ticket->status = 'absent';
        $ticket->absent_at = Carbon::now();

        if ($newLevel < $maxAttempts) {
            // Niveaux < max : absence temporaire, rappel possible
            $ticket->absent_expires_at = null;
        } else {
            // Niveau >= max : absence définitive, expiration programmée
            $timeoutMinutes = max(1, $service?->call_timeout_minutes
                ?? (int) ceil((int) config('queue.call_timeout_seconds', 600) / 60));
            $ticket->absent_expires_at = Carbon::now()->addMinutes($timeoutMinutes);
        }

        $ticket->save();

        $recallPossible = $newLevel < $maxAttempts;

        $this->broadcastSafely(fn() => event(new TicketUpdated($ticket->id, [
            'status'           => 'absent',
            'absent_level'     => $newLevel,
            'deferral_count'   => $ticket->deferral_count,
            'recall_possible'  => $recallPossible,
            'absent_expires_at' => $ticket->absent_expires_at?->toIso8601String(),
            'position'         => null,
            'eta_minutes'      => null,
        ])));

        if ($ticket->user) {
            $this->broadcastSafely(fn() => event(new UserTicketUpdated($ticket->user->id, [
                'ticket_id'        => $ticket->id,
                'service_id'       => $ticket->service_id,
                'status'           => 'absent',
                'absent_level'     => $newLevel,
                'deferral_count'   => $ticket->deferral_count,
                'recall_possible'  => $recallPossible,
                'absent_expires_at' => $ticket->absent_expires_at?->toIso8601String(),
                'position'         => null,
                'eta_minutes'      => null,
            ])));

            if ($newLevel < $maxAttempts) {
                dispatch(new SendPushNotification(
                    $ticket->user->id,
                    'Absence temporaire',
                    "Vous ne vous êtes pas présenté à temps. Votre ticket {$ticket->number} a été marqué absent mais peut encore être rappelé.",
                    ['ticket_id' => $ticket->id, 'service_id' => $ticket->service_id, 'type' => 'absent_first']
                ));
            } else {
                dispatch(new SendPushNotification(
                    $ticket->user->id,
                    'Absence définitive',
                    "Votre ticket {$ticket->number} a été clôturé suite à plusieurs absences. Vous devez prendre un nouveau ticket.",
                    ['ticket_id' => $ticket->id, 'service_id' => $ticket->service_id, 'type' => 'absent_definitive']
                ));
            }
        }

        $this->broadcastSafely(fn() => event(new ServiceTicketAbsent($ticket->service_id, [
            'service_id'     => $ticket->service_id,
            'ticket_id'      => $ticket->id,
            'ticket_number'  => $ticket->number,
            'absent_level'   => $newLevel,
            'deferral_count' => $ticket->deferral_count,
            'ticket'         => ['id' => $ticket->id, 'number' => $ticket->number],
        ])));

        $this->recomputePositions($ticket->service);
        return $ticket->fresh();
    }

    /**
     * Expire définitivement un ticket marqué absent (2e niveau).
     * Appelé par le scheduler quand called_expires_at est dépassé pour un absent définitif.
     */
    public function permanentlyExpireAbsent(Ticket $ticket): Ticket
    {
        // Éviter le double-traitement
        if (in_array($ticket->status, ['closed', 'expired', 'canceled'], true)) {
            return $ticket;
        }

        // Statut 'expired' en base : un absent définitif n'a pas été servi (sinon il
        // serait comptabilisé comme « servi » dans toutes les statistiques).
        // Les événements temps réel conservent status=closed + reason=expired_absent,
        // format attendu par l'application mobile déjà déployée.
        $ticket->status             = 'expired';
        $ticket->position           = null;
        $ticket->eta_minutes        = null;
        $ticket->called_expires_at  = null;
        $ticket->absent_expires_at  = null;
        $ticket->save();

        $this->broadcastSafely(fn() => event(new TicketUpdated($ticket->id, [
            'status'       => 'closed',
            'reason'       => 'expired_absent',
            'absent_level' => $ticket->absent_level,
            'position'     => null,
        ])));

        if ($ticket->user) {
            $this->broadcastSafely(fn() => event(new UserTicketUpdated($ticket->user->id, [
                'ticket_id'    => $ticket->id,
                'service_id'   => $ticket->service_id,
                'status'       => 'closed',
                'reason'       => 'expired_absent',
                'absent_level' => $ticket->absent_level,
                'position'     => null,
            ])));

            dispatch(new SendPushNotification(
                $ticket->user->id,
                'Ticket clôturé',
                "Votre ticket {$ticket->number} a été clôturé suite à plusieurs absences. Vous devez prendre un nouveau ticket.",
                ['ticket_id' => $ticket->id, 'service_id' => $ticket->service_id, 'type' => 'expired_absent']
            ));
        }

        $this->broadcastSafely(fn() => event(new ServiceTicketAbsent($ticket->service_id, [
            'service_id'    => $ticket->service_id,
            'ticket_id'     => $ticket->id,
            'ticket_number' => $ticket->number,
            'reason'        => 'expired_absent',
            'absent_level'  => $ticket->absent_level,
            'ticket'        => ['id' => $ticket->id, 'number' => $ticket->number],
        ])));

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
        if (!in_array($ticket->status, self::ACTIVE_STATUSES, true)) {
            throw new \InvalidArgumentException('Ce ticket est déjà terminé.');
        }

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

        // Diffusion service : les autres guichets/dashboards retirent le ticket
        $this->broadcastSafely(fn() => event(new ServiceTicketServed($ticket->service_id, [
            'service_id'    => $ticket->service_id,
            'ticket_id'     => $ticket->id,
            'ticket_number' => $ticket->number,
            'ticket'        => [
                'id'         => $ticket->id,
                'number'     => $ticket->number,
                'service_id' => $ticket->service_id,
                'closed_at'  => $ticket->closed_at?->toIso8601String(),
            ],
        ])));

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
                ->where('status', 'waiting')
                ->whereDate('valid_date', Carbon::today());

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
            $nextTicketPosition = $nextTicket->position;
            $ticketCounterId = $ticket->counter_id;

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
            $ticket->called_expires_at = null;
            $ticket->counter_id = null;
            $ticket->eta_minutes = $this->estimateWaitTime($service, $ticket);
            $ticket->save();

            // Le ticket suivant est appelé à la place (au même guichet)
            $timeoutMinutes = max(1, $service->call_timeout_minutes
                ?? (int) ceil((int) config('queue.call_timeout_seconds', 600) / 60));
            $nextTicket->position = null;
            $nextTicket->status = 'called';
            $nextTicket->counter_id = $ticketCounterId;
            $nextTicket->en_route_at = null; // Nouvel appel : pas encore de réponse
            $nextTicket->present_at = null;
            $nextTicket->response_received_at = null;
            $nextTicket->en_route_expires_at = null;
            $nextTicket->called_at = Carbon::now();
            // Sans échéance, l'expiration automatique (tickets:expire-called) ne
            // s'appliquerait qu'au délai global de secours.
            $nextTicket->called_expires_at = Carbon::now()->addMinutes($timeoutMinutes);
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

            // Notify agents (le job crée aussi la notification in-app)
            try {
                $agents = $service->agents()->get();
                foreach ($agents as $agent) {
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
            $this->broadcastSafely(fn() => event(new TicketCalled($nextTicket->id, [
                'ticket_id' => $nextTicket->id,
                'number' => $nextTicket->number,
                'counter_id' => $nextTicket->counter_id,
                'service_id' => $service->id,
                'position' => null,
            ])));
            $this->broadcastSafely(fn() => event(new TicketUpdated($nextTicket->id, [
                'status' => 'called',
                'position' => null,
                'eta_minutes' => 0,
                'is_swapped' => true,
                'called_expires_at' => $nextTicket->called_expires_at->toIso8601String(),
            ])));
            $this->broadcastSafely(fn() => event(new ServiceTicketCalled($service->id, [
                'service_id' => $service->id,
                'ticket_id' => $nextTicket->id,
                'ticket_number' => $nextTicket->number,
                'ticket' => [
                    'id' => $nextTicket->id,
                    'number' => $nextTicket->number,
                ],
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
                    'number' => $nextTicket->number,
                    'counter_id' => $nextTicket->counter_id,
                    'position' => null,
                    'eta_minutes' => 0,
                    'called_expires_at' => $nextTicket->called_expires_at->toIso8601String(),
                    'swapped' => true,
                ])));
            }

            $this->recomputePositions($service);

            return $ticket->fresh();
        });
    }

    /**
     * Alias de markAbsent() — conservé pour compatibilité avec les appels existants.
     */
    public function markAbsentWithDeferral(Ticket $ticket): Ticket
    {
        return $this->markAbsent($ticket);
    }

    /**
     * Annule un ticket par l'utilisateur.
     */
    public function cancel(Ticket $ticket): Ticket
    {
        if (!in_array($ticket->status, self::ACTIVE_STATUSES, true)) {
            throw new \InvalidArgumentException('Ce ticket est déjà terminé.');
        }

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
    public function recall(Ticket $ticket, ?int $counterId = null): Ticket
    {
        $this->expireOldTicketsForServiceId($ticket->service_id);

        $ticket->refresh();
        if (!in_array($ticket->status, self::ACTIVE_STATUSES, true)) {
            throw new \InvalidArgumentException('Ce ticket est terminé et ne peut plus être rappelé.');
        }

        $maxAttempts = (int) ($ticket->service?->max_call_attempts ?? 2);

        if (($ticket->absent_level ?? 0) >= $maxAttempts) {
            throw new \InvalidArgumentException('Ce ticket est en absence définitive et ne peut plus être rappelé.');
        }

        $service = $ticket->service;
        $timeoutMinutes = max(1, $service?->call_timeout_minutes
            ?? (int) ceil((int) config('queue.call_timeout_seconds', 600) / 60));
        // Appel direct d'un ticket encore en file (ex: écran « prioritaires ») :
        // la file doit être renumérotée et le message n'est pas un « rappel »
        $wasWaiting = $ticket->status === 'waiting';

        $ticket->status = 'called';
        $ticket->en_route_at = null;
        $ticket->present_at = null;
        $ticket->response_received_at = null;
        $ticket->en_route_expires_at = null;
        if (!is_null($counterId)) {
            $ticket->counter_id = $counterId;
        }
        $ticket->called_at = Carbon::now();
        $ticket->called_expires_at = Carbon::now()->addMinutes($timeoutMinutes);
        $ticket->position = null;
        $ticket->eta_minutes = 0;
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
            'called_expires_at' => $ticket->called_expires_at->toIso8601String(),
            'deferral_count' => $ticket->deferral_count ?? 0,
            'absent_level' => (int) ($ticket->absent_level ?? 0),
            'counter_id' => $ticket->counter_id,
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
                'absent_level' => (int) ($ticket->absent_level ?? 0),
            ])));

            // Send push notification for recall
            dispatch(new SendPushNotification(
                $ticket->user->id,
                $wasWaiting ? 'Vous êtes appelé' : 'Rappel - Votre ticket est appelé',
                'Présentez-vous au guichet pour le ticket '.$ticket->number,
                [
                    'type'       => 'ticket_called',
                    'ticket_id'  => $ticket->id,
                    'service_id' => $ticket->service_id,
                ]
            ));

            // Send SMS if phone available
            if (!empty($ticket->user->phone)) {
                dispatch(new SendSmsNotification($ticket->user->phone, 'Rappel: Votre ticket '.$ticket->number.' est appelé. Présentez-vous au guichet.', [
                    'ticket_id' => $ticket->id,
                ]));
            }
        }

        if ($wasWaiting && $service) {
            $this->recomputePositions($service);
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
        // Heure de fermeture effective du jour (surcharge du jour ouvrable > horaire
        // du service), identique à celle utilisée pour accepter les tickets : sinon un
        // ticket accepté après l'horaire par défaut serait expiré aussitôt.
        [, $closingTime] = $this->availability()->effectiveHoursAt($service, $now);

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
