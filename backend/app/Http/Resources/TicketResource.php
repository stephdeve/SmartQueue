<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Models\Ticket;

class TicketResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Use persisted eta_minutes (computed with dynamic strategy) when available,
        // fallback to static calculation: (position - 1) * avg_service_time
        $persistedEta = $this->eta_minutes ?? null;
        if ($persistedEta !== null) {
            $eta = (int) $persistedEta;
        } else {
            $avg = $this->service->avg_service_time_minutes ?? null;
            $pos = $this->position ?? null;
            $eta = ($avg !== null && $pos !== null) ? (int) max(0, ($pos - 1) * $avg) : null;
        }

        // Compte la file du *jour cible* du ticket (today pour un actif, jour futur pour un différé)
        $waitingCount = Ticket::query()
            ->where('service_id', $this->service_id)
            ->where('status', 'waiting')
            ->whereDate('valid_date', $this->valid_date ?? now()->toDateString())
            ->count();

        // Cohérence métier :
        // - waiting => taille réelle de la file d'attente restante
        // - called/absent/closed/canceled/expired => le ticket n'est plus dans la file
        $queueLength = $this->status === 'waiting' ? $waitingCount : 0;

        return [
            'id' => $this->id,
            // user_id est nécessaire côté mobile pour s'abonner au bon canal
            // WebSocket user.{userId} — sans lui, le hook s'abonne au mauvais canal.
            'user_id' => $this->user_id,
            'number' => $this->number,
            'status' => $this->status,
            'priority'        => $this->priority,
            'priority_reason' => $this->priority_reason,
            'source'          => $this->source ?? 'app',
            'customer_name'  => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'is_senior'      => (bool) $this->is_senior,
            'is_handicap'    => (bool) $this->is_handicap,
            'is_pregnant'    => (bool) $this->is_pregnant,
            'position' => $this->position,
            'queue_length' => $queueLength,
            'eta_minutes' => $eta,
            // Smart queue: ticket auto-reporté à un jour ouvrable ultérieur
            'auto_deferred' => (bool) $this->auto_deferred,
            'defer_reason' => $this->defer_reason,
            'valid_date' => $this->valid_date?->toDateString(),
            'absent_level'     => (int) ($this->absent_level ?? 0),
            'absent_expires_at'=> optional($this->absent_expires_at)->toIso8601String(),
            'deferral_count'   => (int) ($this->deferral_count ?? 0),
            'max_call_attempts' => (int) ($this->service?->max_call_attempts ?? 2),
            'recall_possible'  => ($this->status === 'absent') && ($this->absent_level ?? 0) < (int) ($this->service?->max_call_attempts ?? 2),
            'called_at'       => $this->called_at,
            'called_expires_at' => optional($this->called_expires_at)->toIso8601String(),
            'closed_at' => $this->closed_at,
            'present_at' => $this->present_at,
            'response_received_at' => $this->response_received_at,
            'en_route_expires_at' => optional($this->en_route_expires_at)->toIso8601String(),
            // Exposé pour que le mobile sache si l'utilisateur a déjà répondu à
            // l'appel (statut reste 'called' après "en route") et n'affiche pas
            // l'overlay à nouveau.
            'en_route_at' => $this->en_route_at,
            'estimated_travel_minutes' => $this->estimated_travel_minutes,
            'is_en_route' => $this->status === 'en_route',
            'is_present' => $this->status === 'present',
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'service_id' => $this->service_id,
            'counter_id' => $this->counter_id,
            // Résumé du service
            'service' => $this->service ? [
                'id' => $this->service->id,
                'name' => $this->service->name,
                'status' => $this->service->status,
                'avg_service_time_minutes' => $this->service->avg_service_time_minutes,
                'max_call_attempts' => (int) ($this->service->max_call_attempts ?? 2),
            ] : null,
            // Résumé de l'établissement avec coordonnées
            'establishment' => ($this->service && $this->service->establishment) ? [
                'id' => $this->service->establishment->id,
                'name' => $this->service->establishment->name,
                'lat' => $this->service->establishment->lat !== null ? (float) $this->service->establishment->lat : null,
                'lng' => $this->service->establishment->lng !== null ? (float) $this->service->establishment->lng : null,
                'address' => $this->service->establishment->address,
            ] : null,
        ];
    }
}
