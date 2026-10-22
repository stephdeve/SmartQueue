<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable; // HasApiTokens: émettre des tokens API avec Sanctum

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        // Numéro de téléphone pour OTP/SMS
        'phone',
        // Rôle applicatif (admin, agent, user)
        'role',
        'establishment_id',
        // Statut du compte (active | inactive | pending) : sans lui, le statut choisi
        // pour un agent était ignoré à la création comme à la modification
        'status',
        'pending_subscription',
        // Google OAuth
        'google_id',
        'avatar',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'google_id',
        'stats_data',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'pending_subscription' => 'array',
            'last_login_at' => 'datetime',
        ];
    }

    // Agents: services assignés (pivot agent_service)
    public function services()
    {
        return $this->belongsToMany(Service::class, 'agent_service')->withTimestamps();
    }

    public function establishment()
    {
        return $this->belongsTo(Establishment::class);
    }

    /** Tickets appelés ou clôturés par cet agent. */
    public function handledTickets()
    {
        return $this->hasMany(Ticket::class, 'agent_id');
    }

    public function devices()
    {
        return $this->hasMany(Device::class);
    }

    public function notificationPreference()
    {
        return $this->hasOne(NotificationPreference::class);
    }

    // Préférences d'alerte (mode de transport, marge…) utilisées pour l'ETA "en route"
    public function alertPreference()
    {
        return $this->hasOne(UserAlertPreference::class);
    }

    // Compte désactivé par un admin (agents) : connexion et API refusées
    public function isInactive(): bool
    {
        return ($this->status ?? 'active') === 'inactive';
    }

    public function favoriteEstablishments()
    {
        return $this->belongsToMany(Establishment::class, 'favorites')->withTimestamps();
    }
}

