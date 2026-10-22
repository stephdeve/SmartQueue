<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Service;
use App\Models\Counter;
use App\Models\Subscription;

class Establishment extends Model
{
    // Colonnes modifiables en écriture (mass-assignment)
    protected $fillable = [
        'name',
        'address',
        'category',
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

    public function counters()
    {
        return $this->hasMany(Counter::class);
    }

    public function subscription()
    {
        return $this->hasOne(Subscription::class);
    }

    /** Comptes rattachés (admins et agents). */
    public function staff()
    {
        return $this->hasMany(User::class);
    }

    public function tickets()
    {
        return $this->hasManyThrough(Ticket::class, Service::class);
    }

    public function favoritedBy()
    {
        return $this->belongsToMany(User::class, 'favorites')->withTimestamps();
    }
}
