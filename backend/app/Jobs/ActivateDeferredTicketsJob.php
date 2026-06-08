<?php

namespace App\Jobs;

use App\Events\TicketLifecycle\TicketActivated;
use App\Models\Service;
use App\Models\Ticket;
use App\Services\ServiceAvailabilityService;
use App\Services\TicketService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Activate all auto-deferred tickets whose valid_date is today (or earlier)
 * for a given service. Runs at — or shortly after — the service's opening time.
 *
 * Idempotent: re-running once tickets have been activated is a no-op.
 *
 * Re-orders the active queue applying:
 *   1. priority (vip > high > normal)
 *   2. FIFO inside the same priority class (original created_at)
 */
class ActivateDeferredTicketsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(public readonly int $serviceId)
    {
    }

    public function handle(
        ServiceAvailabilityService $availability,
        TicketService $ticketService,
    ): void {
        $service = Service::find($this->serviceId);
        if (!$service) return;

        // Guardrail: only activate when the service is actually open right now.
        // This avoids racing a tick that fires before the configured opening time.
        if ($availability->reasonClosedAt($service, Carbon::now()) !== null) {
            return;
        }

        // Collect everything pending for today or older that hasn't been activated yet.
        // (older valid_date can occur if the scheduler missed a previous day —
        //  the guarantee is "no deferred ticket is ever lost".)
        $today = Carbon::today()->toDateString();

        $activated = DB::transaction(function () use ($service, $today, $ticketService) {
            $tickets = Ticket::query()
                ->where('service_id', $service->id)
                ->where('auto_deferred', true)
                ->where('status', 'waiting')
                ->whereDate('valid_date', '<=', $today)
                ->lockForUpdate()
                ->orderByRaw("CASE priority WHEN 'vip' THEN 3 WHEN 'high' THEN 2 ELSE 1 END DESC")
                ->orderBy('created_at')
                ->orderBy('id')
                ->get();

            if ($tickets->isEmpty()) {
                return collect();
            }

            // Compute the starting rank: append after any tickets that may already be
            // active today (rare, but handles partial activations / manual entries).
            $startPos = Ticket::query()
                ->where('service_id', $service->id)
                ->where('status', 'waiting')
                ->where('auto_deferred', false)
                ->whereDate('valid_date', $today)
                ->count();

            $pos = $startPos + 1;
            foreach ($tickets as $t) {
                $t->update([
                    'auto_deferred' => false,
                    'defer_reason'  => null,
                    'valid_date'    => $today,
                    'position'      => $pos,
                ]);
                $pos++;
            }

            return $tickets;
        });

        if ($activated->isEmpty()) return;

        // Recompute positions so any pre-existing active tickets are merged correctly,
        // then fire activation events with the *final* position for each ticket.
        $ticketService->recomputePositions($service);

        foreach ($activated as $t) {
            $fresh = Ticket::find($t->id);
            if (!$fresh) continue;
            event(new TicketActivated($fresh->id, (int) ($fresh->position ?? 0)));
        }

        Log::info('ActivateDeferredTicketsJob: activated tickets', [
            'service_id' => $service->id,
            'count' => $activated->count(),
        ]);
    }
}
