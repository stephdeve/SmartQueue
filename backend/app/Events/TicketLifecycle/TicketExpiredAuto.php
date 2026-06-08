<?php

namespace App\Events\TicketLifecycle;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired when a ticket is auto-expired by the scheduler — typically at service close
 * (unserved tickets) or stale (valid_date in the past).
 */
class TicketExpiredAuto
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly int $ticketId,
        public readonly string $reason, // 'service_closed' | 'stale'
    ) {}
}
