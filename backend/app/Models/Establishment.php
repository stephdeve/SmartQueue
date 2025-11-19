<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Service;

class Establishment extends Model
{
    // Colonnes modifiables en écriture (mass-assignment)
    protected $fillable = [
        'name',
        'address',
        'lat',
        'lng',
        'open_at',
        'close_at',
        'is_active',
    ];

    // Relations
    public function services()
    {
        // Un établissement possède plusieurs services (files d'attente)
        return $this->hasMany(Service::class);
    }
}
