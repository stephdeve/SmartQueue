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
            'name' => $this->name,
            'status' => $this->status,
            'avg_service_time_minutes' => (int) $this->avg_service_time_minutes,
            // Nombre de personnes en attente si chargé via withCount
            'people_waiting' => isset($this->people_waiting) ? (int) $this->people_waiting : null,
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
