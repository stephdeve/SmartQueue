<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Configuration d'un service modifiée (délai de priorité, tentatives, délai de présentation).
 *
 * Diffusé immédiatement (pas de dépendance au worker de queue) sur le même canal de
 * présence que les autres événements de file, afin que les dashboards agent/admin
 * déjà abonnés via Echo.join(`service.${id}`) le reçoivent.
 */
class ServiceConfigUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public array $config;
    public int $serviceId;

    public function __construct(int $serviceId, array $config)
    {
        $this->serviceId = $serviceId;
        $this->config = $config;
    }

    public function broadcastOn(): array
    {
        return [new PresenceChannel('service.' . $this->serviceId)];
    }

    public function broadcastAs(): string
    {
        return 'ServiceConfigUpdated';
    }

    public function broadcastWith(): array
    {
        return $this->config;
    }
}
