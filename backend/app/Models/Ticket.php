<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User;
use App\Models\Service;

class Ticket extends Model
{
    // Colonnes autorisées en écriture
    protected $fillable = [
        'user_id', 'service_id', 'counter_id', 'number', 'status', 'priority', 'position',
        'called_at', 'closed_at', 'absent_at', 'last_distance_m', 'last_seen_at',
        'has_recalled', 'en_route_at', 'present_at', 'en_route_expires_at', 'response_received_at', 'estimated_travel_minutes', 'called_counter_id',
        'deferred_at', 'deferral_count', 'is_swapped', 'swapped_with_ticket_id',
        'original_called_at', 'grace_period_expires_at',
        'source', 'valid_date',
        'eta_minutes', 'last_lat', 'last_lng',
        'auto_deferred', 'defer_reason',
    ];

    // Casting automatique des dates/horaires
    protected $casts = [
        'called_at' => 'datetime',
        'closed_at' => 'datetime',
        'absent_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'en_route_at' => 'datetime',
        'present_at' => 'datetime',
        'en_route_expires_at' => 'datetime',
        'response_received_at' => 'datetime',
        'has_recalled' => 'boolean',
        'deferred_at' => 'datetime',
        'is_swapped' => 'boolean',
        'original_called_at' => 'datetime',
        'grace_period_expires_at' => 'datetime',
        'valid_date' => 'date',
        'auto_deferred' => 'boolean',
    ];

    // Relation vers l'utilisateur détenteur du ticket
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Relation vers le service associé
    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function counter()
    {
        return $this->belongsTo(Counter::class);
    }

    // Scope: tickets encore actifs (non clos/cancel)
    public function scopeActive($q)
    {
        return $q->whereNotIn('status', ['closed','canceled','expired']);
    }
}
