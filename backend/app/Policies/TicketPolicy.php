<?php

namespace App\Policies;

use App\Models\Ticket;
use App\Models\User;

class TicketPolicy
{
    // Lecture: propriétaire du ticket ou personnel habilité sur le service du ticket
    public function view(User $user, Ticket $ticket): bool
    {
        return (int) $ticket->user_id === (int) $user->id || $this->actOn($user, $ticket);
    }

    // Mise à jour par l'utilisateur: uniquement pour annuler un ticket encore actif
    public function update(User $user, Ticket $ticket): bool
    {
        return (int) $ticket->user_id === (int) $user->id
            && in_array($ticket->status, ['waiting', 'called', 'en_route', 'absent'], true);
    }

    // Actions agent: appeler, marquer absent, rappeler — limitées aux services
    // que l'agent/admin gère (pas d'action possible sur un autre établissement)
    public function actOn(User $user, Ticket $ticket): bool
    {
        if (!in_array($user->role, ['agent', 'admin'], true)) {
            return false;
        }

        $service = $ticket->service;

        return $service !== null && (new ServicePolicy())->manage($user, $service);
    }
}
