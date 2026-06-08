<?php

namespace App\Console\Commands;

use App\Jobs\ActivateDeferredTicketsJob;
use App\Models\Service;
use App\Models\Ticket;
use App\Services\ServiceAvailabilityService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Scheduler sweep: for every service that is currently open *and* has at least
 * one auto-deferred ticket eligible for activation, dispatch ActivateDeferredTicketsJob.
 *
 * Runs every minute. The job itself is idempotent — a missed minute is recovered
 * on the next tick, satisfying "aucun ticket différé ne soit perdu".
 */
class QueueActivateDeferred extends Command
{
    protected $signature = 'queue:activate-deferred {--service_id=} {--dry-run}';
    protected $description = 'Activate auto-deferred tickets for services currently in their open window';

    public function handle(ServiceAvailabilityService $availability): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $serviceIdOpt = $this->option('service_id');
        $today = Carbon::today()->toDateString();

        // Pick only services that have pending deferred tickets for today or earlier
        $services = Service::query()
            ->where('status', 'open')
            ->when($serviceIdOpt, fn ($q) => $q->where('id', (int) $serviceIdOpt))
            ->whereExists(function ($sub) use ($today) {
                $sub->select('id')->from('tickets')
                    ->whereColumn('tickets.service_id', 'services.id')
                    ->where('auto_deferred', true)
                    ->where('status', 'waiting')
                    ->whereDate('valid_date', '<=', $today);
            })
            ->with(['workingDays', 'exceptions'])
            ->get();

        $dispatched = 0;
        foreach ($services as $service) {
            // Only activate when the service is actually open right now.
            if ($availability->reasonClosedAt($service, Carbon::now()) !== null) {
                continue;
            }
            if ($dryRun) {
                $this->line("[dry-run] would activate deferred for service {$service->id}");
            } else {
                ActivateDeferredTicketsJob::dispatch($service->id);
            }
            $dispatched++;
        }

        $this->info(($dryRun ? '[dry-run] ' : '') . "Dispatched activation for {$dispatched} service(s)");
        return self::SUCCESS;
    }
}
