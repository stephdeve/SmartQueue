<?php

use Illuminate\Support\Facades\Broadcast;
use App\Models\Service;
use App\Models\Ticket;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
| Définition des canaux de diffusion en temps réel pour tickets et services.
| Les canaux privés et de présence sont sécurisés via une callback d'autorisation.
|
| Les noms sont déclarés SANS préfixe : Laravel retire "private-" / "presence-"
| du nom demandé par le client avant de le comparer à ces motifs.
*/

// Canal privé pour un ticket donné: réservé au propriétaire du ticket + personnel du service
Broadcast::channel('ticket.{ticketId}', function ($user, int $ticketId) {
    $ticket = Ticket::query()->with('service')->find($ticketId);
    if (!$ticket) {
        return false;
    }

    if ((int) $ticket->user_id === (int) $user->id) {
        return true;
    }

    return $ticket->service && $user->can('manage', $ticket->service);
});

// Canal privé pour l'utilisateur: réservé à l'utilisateur lui-même
Broadcast::channel('user.{userId}', function ($user, int $userId) {
    return (int) $user->id === (int) $userId;
});

// Canal de présence d'un service (client : Echo.join(`service.${id}`)).
// Réservé aux agents assignés et aux admins de l'établissement.
// Les usagers doivent écouter exclusivement user.{userId} / ticket.{ticketId}
// pour éviter de recevoir des événements globaux concernant d'autres tickets.
Broadcast::channel('service.{serviceId}', function ($user, int $serviceId) {
    $service = Service::find($serviceId);
    if (!$service || !$user->can('manage', $service)) {
        return false;
    }

    return ['id' => $user->id, 'name' => $user->name, 'role' => $user->role];
});
