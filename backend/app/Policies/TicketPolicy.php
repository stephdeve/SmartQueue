<?php

namespace App\Policies;

use App\Models\Ticket;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class TicketPolicy
{
    // Lecture: propriétaire du ticket ou agent/admin
    public function view(User $user, Ticket $ticket): bool
    {
        return $ticket->user_id === $user->id || in_array($user->role, ['agent','admin'], true);
    }

    // Mise à jour par l'utilisateur: uniquement pour annuler un ticket en attente ou appelé
    public function update(User $user, Ticket $ticket): bool
    {
        return $ticket->user_id === $user->id && in_array($ticket->status, ['waiting', 'called']);
    }

    // Actions agent: appeler, marquer absent, rappeler
    public function actOn(User $user, Ticket $ticket): bool
    {
        return in_array($user->role, ['agent','admin'], true);
    }
}

