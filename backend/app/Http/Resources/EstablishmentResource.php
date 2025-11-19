<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EstablishmentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            // Identifiants et libellés
            'id' => $this->id,
            'name' => $this->name,
            'address' => $this->address,
            // Coordonnées (décimales)
            'lat' => $this->lat,
            'lng' => $this->lng,
            // Horaires d'ouverture indicatifs
            'open_at' => $this->open_at,
            'close_at' => $this->close_at,
            // Actif/inactif
            'is_active' => (bool) $this->is_active,
            // Distance (en mètres) si calculée en SQL (selectRaw)
            'distance_m' => isset($this->distance_m) ? (int) $this->distance_m : null,
        ];
    }
}
