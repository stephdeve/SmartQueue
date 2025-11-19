<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TicketCalled implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Crée un nouvel événement d'appel de ticket.
     * @param int $ticketId Identifiant du ticket
     * @param array $data Données additionnelles (ex: number)
     */
    public function __construct(public int $ticketId, public array $data = [])
    {
        //
    }

    /**
     * Nom d'événement côté client
     */
    public function broadcastAs(): string
    {
        return 'ticket.called';
    }

    /**
     * Canal privé spécifique au ticket
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('private-ticket.'.$this->ticketId)];
    }

    /**
     * Données envoyées au client
     */
    public function broadcastWith(): array
    {
        return $this->data;
    }
}
