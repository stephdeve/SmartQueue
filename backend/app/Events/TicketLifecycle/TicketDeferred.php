<?php

namespace App\Events\TicketLifecycle;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired when an already-active ticket is bumped to a future day by the scheduler
 * (mid-day critical-zone re-evaluation). For tickets that were already deferred at
 * creation, use TicketCreated with isDeferred=true instead.
 */
class TicketDeferred
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly int $ticketId,
        public readonly string $reason,
        public readonly ?string $previousValidDate,
        public readonly string $newValidDate,
    ) {}
}
