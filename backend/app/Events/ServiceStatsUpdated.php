<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ServiceStatsUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param int $serviceId Identifiant du service
     * @param array $data Données stats {people, eta_avg, timestamp?}
     */
    public function __construct(public int $serviceId, public array $data = [])
    {
        //
    }

    /**
     * Nom d'événement côté client
     */
    public function broadcastAs(): string
    {
        return 'service.stats.updated';
    }

    /**
     * Canal de présence du service (réservé aux agents/admins)
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [new PresenceChannel('presence-service.'.$this->serviceId)];
    }

    /**
     * Charge utile envoyée au client
     */
    public function broadcastWith(): array
    {
        return $this->data;
    }
}
