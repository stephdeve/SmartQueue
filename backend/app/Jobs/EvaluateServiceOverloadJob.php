<?php

namespace App\Jobs;

use App\Events\TicketLifecycle\TicketDeferred;
use App\Models\Service;
use App\Models\Ticket;
use App\Services\ServiceAvailabilityService;
use App\Services\SmartQueueEngine;
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
 * Mid-day overload re-evaluation for one service.
 *
 * Compares time_remaining vs cumulative_load:
 *   - walks today's waiting tickets in serving order
 *   - accumulates (position × avg_service_time)
 *   - tickets whose projected service time exceeds today's closing are bumped
 *     to the next valid open day (auto_deferred = true, valid_date = next_opening)
 *
 * The job is fully idempotent — running it twice in the same minute simply
 * doesn't bump anything the second time.
 */
class EvaluateServiceOverloadJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 2;
    public int $backoff = 15;

    public function __construct(public readonly int $serviceId)
    {
    }

    public function handle(
        ServiceAvailabilityService $availability,
        SmartQueueEngine $smartQueue,
        TicketService $ticketService,
    ): void {
        $service = Service::find($this->serviceId);
        if (!$service || $service->status !== 'open') return;

        $now = Carbon::now();

        // Only re-evaluate while service is actively open. If we're outside the window,
        // CloseServiceDayJob handles the cleanup.
        $reason = $availability->reasonClosedAt($service, $now);
        if ($reason !== null) return;

        $snapshot = $availability->snapshot($service, $now);
        $closeStr = $snapshot['closing_time'];
        $closeAt = Carbon::createFromFormat(
            'Y-m-d H:i:s',
            $now->toDateString() . ' ' . $this->normalize($closeStr)
        );

        // diffInMinutes returns negative when $closeAt is in the future of $now, so we
        // pass signed=false and compute the gap directly.
        $remainingMinutes = max(0, (int) $now->diffInMinutes($closeAt, false));

        if ($remainingMinutes <= 0) return; // closing handles this

        $avg = max(1, (int) ($service->avg_service_time_minutes ?? 5));
        $today = $now->toDateString();

        // Lock the active queue while we plan the bumps.
        $toDefer = DB::transaction(function () use ($service, $today, $remainingMinutes, $avg) {
            $waiting = Ticket::query()
                ->where('service_id', $service->id)
                ->where('status', 'waiting')
                ->whereDate('valid_date', $today)
                ->lockForUpdate()
                ->orderByRaw("CASE priority WHEN 'vip' THEN 3 WHEN 'high' THEN 2 ELSE 1 END DESC")
                ->orderBy('position')
                ->orderBy('created_at')
                ->orderBy('id')
                ->get();

            $cumulative = 0;
            $bumps = collect();
            foreach ($waiting as $t) {
                $cumulative += $avg;
                if ($cumulative > $remainingMinutes) {
                    $bumps->push($t);
                }
            }
            return $bumps;
        });

        if ($toDefer->isEmpty()) return;

        // Resolve next opening once — same target for every bumped ticket of this run.
        $nextOpening = $availability->nextOpeningFrom(
            $service,
            $now->copy()->addDay()->startOfDay()
        );
        if (!$nextOpening) {
            Log::warning('EvaluateServiceOverloadJob: no next opening, skipping bumps', [
                'service_id' => $service->id,
                'to_defer' => $toDefer->count(),
            ]);
            return;
        }
        $targetDate = $nextOpening->toDateString();

        // Bump each ticket and emit a domain event.
        $bumped = 0;
        foreach ($toDefer as $t) {
            $prev = $t->valid_date?->toDateString();
            // Append at the end of the deferred queue for the target date.
            $deferredPos = Ticket::query()
                ->where('service_id', $service->id)
                ->where('status', 'waiting')
                ->whereDate('valid_date', $targetDate)
                ->count() + 1;

            $t->update([
                'valid_date'   => $targetDate,
                'auto_deferred'=> true,
                'defer_reason' => 'critical_zone',
                'position'     => $deferredPos,
                'eta_minutes'  => null,
            ]);

            event(new TicketDeferred(
                ticketId: $t->id,
                reason: 'critical_zone',
                previousValidDate: $prev,
                newValidDate: $targetDate,
            ));
            $bumped++;
        }

        // Recompute active queue positions after bumps.
        $ticketService->recomputePositions($service);

        Log::info('EvaluateServiceOverloadJob: bumped tickets to deferred queue', [
            'service_id' => $service->id,
            'bumped'     => $bumped,
            'target'     => $targetDate,
        ]);
    }

    private function normalize(string $time): string
    {
        return preg_match('/^\d{2}:\d{2}$/', $time) ? $time . ':00' : $time;
    }
}
