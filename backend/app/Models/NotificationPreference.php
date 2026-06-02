<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificationPreference extends Model
{
    protected $fillable = [
        'user_id',
        'push_enabled',
        'sms_enabled',
        'notify_before_positions',
        'notify_before_minutes',
        'last_notified_ticket_id',
        'last_notified_at',
        'last_notification_payload',
    ];

    protected $casts = [
        'push_enabled' => 'boolean',
        'sms_enabled' => 'boolean',
        'notify_before_positions' => 'integer',
        'notify_before_minutes' => 'integer',
        'last_notified_ticket_id' => 'integer',
        'last_notified_at' => 'datetime',
        'last_notification_payload' => 'string',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
