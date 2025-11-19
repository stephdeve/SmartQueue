<?php

namespace App\Services;

use App\Events\TicketCalled;
use App\Events\TicketUpdated;
use App\Events\ServiceStatsUpdated;
use App\Events\ServiceTicketCalled;
use App\Events\ServiceTicketAbsent;
use App\Events\ServiceTicketEnqueued;
use App\Jobs\SendPushNotification;
use App\Jobs\SendSmsNotification;
use App\Models\Service;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TicketService
{
    /**
     * Crée un ticket pour un service donné avec logique de position et numérotation.
     */
    public function createTicket(User $user, int $serviceId, ?float $lat = null, ?float $lng = null, ?string $fromQr = null): Ticket
    {
        return DB::transaction(function () use ($user, $serviceId, $lat, $lng) {
            $service = Service::query()->findOrFail($serviceId);

            // Vérifier que le service est ouvert
            if ($service->status !== 'open') {
                abort(422, 'Service is closed');
            }

            // Empêcher plusieurs tickets actifs pour le même service et utilisateur
            $already = Ticket::query()
                ->where('user_id', $user->id)
                ->where('service_id', $serviceId)
                ->whereIn('status', ['waiting','called','absent'])
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
                'last_distance_m' => $this->estimateDistanceMeters($lat, $lng, $service),
                'last_seen_at' => Carbon::now(),
            ]);

            // Broadcast mise à jour initiale
            event(new TicketUpdated($ticket->id, [
                'status' => $ticket->status,
                'position' => $ticket->position,
            ]));

            // Diffusion sur le canal de présence du service: nouveau ticket en file
            event(new ServiceTicketEnqueued($service->id, [
                'ticket' => [
                    'id' => $ticket->id,
                    'number' => $ticket->number,
                    'priority' => $ticket->priority,
                ]
            ]));

            // Mise à jour des stats de file
            $this->recomputePositions($service);

            return $ticket->fresh(['service.establishment']);
        });
    }

    /**
     * Appelle le prochain ticket prêt pour un service (priorité > ancienneté).
     */
    public function callNext(Service $service): ?Ticket
    {
        return DB::transaction(function () use ($service) {
            // Sélection du prochain ticket waiting
            $ticket = Ticket::query()
                ->where('service_id', $service->id)
                ->where('status', 'waiting')
                ->orderByRaw("CASE priority WHEN 'vip' THEN 3 WHEN 'high' THEN 2 ELSE 1 END DESC")
                ->orderBy('created_at')
                ->lockForUpdate()
                ->first();

            if (!$ticket) {
                return null;
            }

            $ticket->status = 'called';
            $ticket->called_at = Carbon::now();
            $ticket->save();

            // Diffusion: ticket appelé
            event(new TicketCalled($ticket->id, [
                'number' => $ticket->number,
            ]));
            event(new TicketUpdated($ticket->id, [
                'status' => $ticket->status,
            ]));

            // Diffusion service: ticket appelé
            event(new ServiceTicketCalled($service->id, [
                'ticket' => [
                    'id' => $ticket->id,
                    'number' => $ticket->number,
                ]
            ]));

            // Notifications push & SMS (asynchrones via queue)
            if ($ticket->user) {
                dispatch(new SendPushNotification($ticket->user->id, 'Vous êtes appelé', 'Présentez-vous au guichet', [
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
        $ticket->status = 'absent';
        $ticket->absent_at = Carbon::now();
        $ticket->save();

        event(new TicketUpdated($ticket->id, ['status' => $ticket->status]));

        // Diffusion service: ticket marqué absent
        event(new ServiceTicketAbsent($ticket->service_id, [
            'ticket' => [
                'id' => $ticket->id,
                'number' => $ticket->number,
            ]
        ]));

        if ($ticket->user && !empty($ticket->user->phone)) {
            dispatch(new SendSmsNotification($ticket->user->phone, 'Vous avez été marqué absent pour le ticket '.$ticket->number));
        }

        $this->recomputePositions($ticket->service);
        return $ticket->fresh();
    }

    /**
     * Annule un ticket par l'utilisateur.
     */
    public function cancel(Ticket $ticket): Ticket
    {
        $ticket->status = 'canceled';
        $ticket->save();
        event(new TicketUpdated($ticket->id, ['status' => $ticket->status]));
        $this->recomputePositions($ticket->service);
        return $ticket->fresh();
    }

    /**
     * Rappelle un ticket (repasse en called si toujours éligible).
     */
    public function recall(Ticket $ticket): Ticket
    {
        $ticket->status = 'called';
        $ticket->called_at = Carbon::now();
        $ticket->save();
        event(new TicketCalled($ticket->id, ['number' => $ticket->number]));
        event(new ServiceTicketCalled($ticket->service_id, [
            'ticket' => [
                'id' => $ticket->id,
                'number' => $ticket->number,
            ]
        ]));
        return $ticket->fresh();
    }

    /**
     * Recalcule la position de tous les tickets en attente d'un service et diffuse stats.
     */
    public function recomputePositions(Service $service): void
    {
        $waiting = Ticket::query()
            ->where('service_id', $service->id)
            ->where('status', 'waiting')
            ->orderByRaw("CASE priority WHEN 'vip' THEN 3 WHEN 'high' THEN 2 ELSE 1 END DESC")
            ->orderBy('created_at')
            ->get();

        $pos = 1;
        foreach ($waiting as $t) {
            if ($t->position !== $pos) {
                $t->position = $pos;
                $t->save();
                event(new TicketUpdated($t->id, ['position' => $pos]));
            }
            $pos++;
        }

        // Diffusion des stats de file pour tableaux de bord
        event(new ServiceStatsUpdated($service->id, [
            'people' => $waiting->count(),
            'eta_avg' => $service->avg_service_time_minutes,
        ]));
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
}
