<?php

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;
use App\Models\Ticket;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
| Définition des canaux de diffusion en temps réel pour tickets et services.
| Les canaux privés et de présence sont sécurisés via une callback d'autorisation.
*/

// Canal privé pour un ticket donné: réservé au propriétaire du ticket + agents/admins
Broadcast::channel('private-ticket.{ticketId}', function ($user, int $ticketId) {
    // Autoriser si l'utilisateur est propriétaire du ticket ou si c'est un agent/admin
    $isOwner = Ticket::where('id', $ticketId)->where('user_id', $user->id)->exists();
    return $isOwner || in_array($user->role, ['agent','admin'], true);
});

// Canal de présence d'un service: agents/admins uniquement
Broadcast::channel('presence-service.{serviceId}', function ($user, int $serviceId) {
    if (!in_array($user->role, ['agent','admin'], true)) {
        return false;
    }
    // Les canaux de présence attendent un tableau d'infos utilisateur à partager
    return ['id' => $user->id, 'name' => $user->name, 'role' => $user->role];
});
