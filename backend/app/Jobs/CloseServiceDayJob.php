<?php

namespace App\Jobs;

use App\Events\TicketLifecycle\TicketExpiredAuto;
use App\Models\Service;
use App\Models\Ticket;
use App\Services\ServiceAvailabilityService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Close-of-day routine for one service.
 *
 *  1. Expire every still-waiting / still-called ticket of today that wasn't served.
 *     - The "called/absent" states are also expired since the service is now closed.
 *  2. Fire a TicketExpiredAuto event per ticket (drives push notifications).
 *  3. Leave auto-deferred tickets (valid_date in the future) untouched — they will
 *     activate tomorrow.
 *
 * Idempotent: re-running after closure finds zero unserved tickets and does nothing.
 */
class CloseServiceDayJob implements ShouldQueue
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

    public function handle(ServiceAvailabilityService $availability): void
    {
        $service = Service::find($this->serviceId);
        if (!$service) return;

        $now = Carbon::now();
        $today = $now->toDateString();

        // Sanity check: only close when service has actually reached its closing time.
        $snapshot = $availability->snapshot($service, $now);
        if (!$snapshot['closing_time']) return;
        $closeAt = Carbon::createFromFormat(
            'Y-m-d H:i:s',
            $today . ' ' . $this->normalize($snapshot['closing_time'])
        );
        if ($now->lt($closeAt)) return;

        $expiredIds = DB::transaction(function () use ($service, $today) {
            $rows = Ticket::query()
                ->where('service_id', $service->id)
                ->whereIn('status', ['waiting', 'called', 'en_route', 'present', 'absent'])
                ->whereDate('valid_date', $today)
                ->where('auto_deferred', false)
                ->lockForUpdate()
                ->pluck('id');

            if ($rows->isEmpty()) return $rows;

            Ticket::query()
                ->whereIn('id', $rows->all())
                ->update([
                    'status' => 'expired',
                    'position' => null,
                    'eta_minutes' => null,
                    'updated_at' => Carbon::now(),
                ]);

            return $rows;
        });

        foreach ($expiredIds as $id) {
            event(new TicketExpiredAuto($id, 'service_closed'));
        }

        if ($expiredIds->isNotEmpty()) {
            Log::info('CloseServiceDayJob: expired tickets at close', [
                'service_id' => $service->id,
                'count' => $expiredIds->count(),
            ]);
        }
    }

    private function normalize(string $time): string
    {
        return preg_match('/^\d{2}:\d{2}$/', $time) ? $time . ':00' : $time;
    }
}
