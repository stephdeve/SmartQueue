<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Ticket;

class NotificationLog extends Model
{
    // Autorise l'assignation de masse pour les colonnes utilisées par les Jobs
    protected $fillable = [
        'ticket_id', 'channel', 'type', 'status', 'payload', 'sent_at'
    ];

    // Cast JSON pour le payload
    protected $casts = [
        'payload' => 'array',
        'sent_at' => 'datetime',
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class);
    }
}
