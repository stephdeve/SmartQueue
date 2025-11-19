<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TicketUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Données utiles du broadcast (statut, position, ETA, ...)
     */
    public function __construct(public int $ticketId, public array $data = [])
    {
        //
    }

    /**
     * Nom de l'événement côté client
     */
    public function broadcastAs(): string
    {
        return 'ticket.updated';
    }

    /**
     * Canal ciblé: canal privé du ticket
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('private-ticket.'.$this->ticketId)];
    }

    /**
     * Charge utile envoyée au client (JSON)
     */
    public function broadcastWith(): array
    {
        return $this->data;
    }
}
