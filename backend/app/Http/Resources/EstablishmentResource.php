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
            'category' => $this->category,
            // Coordonnées (décimales)
            // Les colonnes decimal sont renvoyées en chaîne par PDO : nombres pour les cartes
            'lat' => $this->lat !== null ? (float) $this->lat : null,
            'lng' => $this->lng !== null ? (float) $this->lng : null,
            // Horaires d'ouverture indicatifs
            'open_at' => $this->open_at,
            'close_at' => $this->close_at,
            // Actif/inactif
            'is_active' => (bool) $this->is_active,
            // Distance (en mètres) si calculée en SQL (selectRaw)
            'distance_m' => isset($this->distance_m) ? (int) $this->distance_m : null,
            // Affluence (si join/aggregate effectué côté controller)
            'crowd_level' => isset($this->crowd_level) ? (string) $this->crowd_level : null,
            'people_waiting' => isset($this->people_waiting) ? (int) $this->people_waiting : null,
            // Nombre de services disponibles
            'services_count' => isset($this->services_count) ? (int) $this->services_count : null,
            // Favori de l'utilisateur connecté
            'is_favorited' => (bool) ($this->is_favorited ?? false),
            // Date de création
            'created_at' => $this->created_at,
        ];
    }
}
