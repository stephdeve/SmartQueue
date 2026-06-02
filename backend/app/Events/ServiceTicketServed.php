<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Queue\SerializesModels;

/**
 * Diffusé sur le canal du service quand un usager confirme sa présence
 * ("Je suis déjà là") et que son ticket est automatiquement clos.
 * Permet à l'agent de voir la mise à jour en temps réel sans action de sa part.
 */
class ServiceTicketServed implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public int $serviceId, public array $data = [])
    {
    }

    public function broadcastAs(): string
    {
        return 'service.ticket.served';
    }

    public function broadcastOn(): array
    {
        return [new PresenceChannel('service.'.$this->serviceId)];
    }

    public function broadcastWith(): array
    {
        return $this->data;
    }
}
