<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User; // Importation du modèle User

class Device extends Model
{
    // Colonnes modifiables en écriture
    protected $fillable = [
        'user_id', 'fcm_token', 'platform', 'app_version', 'push_enabled', 'sms_enabled'
    ];

    // Relation vers l'utilisateur propriétaire du device
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
