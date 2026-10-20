<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'establishment_id' => $this->establishment_id,
            'name' => $this->name,
            'status' => $this->status,
            // Sans ces champs, le formulaire d'édition admin réinitialisait capacité et priorité
            'priority_support' => (bool) $this->priority_support,
            'capacity' => $this->capacity !== null ? (int) $this->capacity : null,
            'opening_time' => $this->opening_time,
            'closing_time' => $this->closing_time,
            'avg_service_time_minutes' => (int) $this->avg_service_time_minutes,
            'priority_mode' => $this->priority_mode ?? 'immediate',
            'priority_weighted_ratio' => (int) ($this->priority_weighted_ratio ?? 5),
            'call_timeout_minutes' => $this->call_timeout_minutes !== null ? (int) $this->call_timeout_minutes : null,
            'max_call_attempts' => (int) ($this->max_call_attempts ?? 2),
            'en_route_grace_minutes' => (int) ($this->en_route_grace_minutes ?? 10),
            // Nombre de personnes en attente si chargé via withCount
            'people_waiting' => isset($this->people_waiting) ? (int) $this->people_waiting : null,
            // Nombre d'agents assignés si chargé via withCount
            'agents_count' => isset($this->agents_count) ? (int) $this->agents_count : null,
            // Jours ouvrables avec horaires (fallback sur opening_time/closing_time du service)
            'working_days' => $this->whenLoaded('workingDays', function () {
                return $this->workingDays->map(fn($wd) => [
                    'day_of_week' => $wd->day_of_week,
                    'is_open'     => $wd->is_open,
                    'opening_time' => $wd->opening_time,
                    'closing_time' => $wd->closing_time,
                ])->values();
            }),
            // QR code : uniquement pour l'administration (le jeton permet de prendre un
            // ticket "sur place" ; il ne doit pas être exposé par l'API publique)
            $this->mergeWhen($request->is('api/admin/*'), fn () => [
                'qr_code_token' => $this->qr_code_token,
                'qr_code_url' => $this->qr_code_url,
                'qr_generated_at' => $this->qr_generated_at?->toIso8601String(),
            ]),
            // Etablissement parent (résumé)
            'establishment' => $this->whenLoaded('establishment', function () {
                return [
                    'id' => $this->establishment->id,
                    'name' => $this->establishment->name,
                ];
            }),
        ];
    }
}
