<?php

namespace App\Events\TicketLifecycle;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired when a previously auto-deferred ticket is activated at the start of a new
 * business day. The ticket has been re-ranked into the active queue.
 */
class TicketActivated
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly int $ticketId,
        public readonly int $position,
    ) {}
}
