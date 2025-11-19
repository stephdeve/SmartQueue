<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TicketResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Estimation simple de l'ETA (minutes): position * avg_service_time
        $avg = $this->service->avg_service_time_minutes ?? null;
        $pos = $this->position ?? null;
        $eta = ($avg !== null && $pos !== null) ? (int) max(0, $avg * $pos) : null;

        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status,
            'priority' => $this->priority,
            'position' => $this->position,
            'eta_minutes' => $eta,
            'called_at' => $this->called_at,
            // Résumé du service
            'service' => [
                'id' => $this->service->id,
                'name' => $this->service->name,
                'status' => $this->service->status,
                'avg_service_time_minutes' => $this->service->avg_service_time_minutes,
            ],
            // Résumé de l'établissement
            'establishment' => [
                'id' => $this->service->establishment->id,
                'name' => $this->service->establishment->name,
            ],
        ];
    }
}
