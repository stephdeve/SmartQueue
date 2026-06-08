<?php

namespace App\Events\TicketLifecycle;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired after a ticket is persisted (either as active or auto-deferred).
 * Listeners decide what to notify based on $isDeferred.
 */
class TicketCreated
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly int $ticketId,
        public readonly bool $isDeferred,
        public readonly ?string $deferReason = null,
    ) {}
}
