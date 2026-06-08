<?php

namespace App\Console\Commands;

use App\Jobs\EvaluateServiceOverloadJob;
use App\Models\Service;
use App\Services\ServiceAvailabilityService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Scheduler sweep: for each currently-open service, dispatch
 * EvaluateServiceOverloadJob. The job decides whether tickets need to be bumped
 * into the deferred queue based on the intelligent cutoff.
 */
class QueueCheckOverload extends Command
{
    protected $signature = 'queue:check-overload {--service_id=} {--dry-run}';
    protected $description = 'Re-evaluate intelligent cutoff and bump tickets to deferred when overloaded';

    public function handle(ServiceAvailabilityService $availability): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $serviceIdOpt = $this->option('service_id');

        $services = Service::query()
            ->where('status', 'open')
            ->when($serviceIdOpt, fn ($q) => $q->where('id', (int) $serviceIdOpt))
            ->with(['workingDays', 'exceptions'])
            ->get();

        $dispatched = 0;
        foreach ($services as $service) {
            // Skip services that are currently closed by schedule
            if ($availability->reasonClosedAt($service, Carbon::now()) !== null) {
                continue;
            }
            if ($dryRun) {
                $this->line("[dry-run] would evaluate overload for service {$service->id}");
            } else {
                EvaluateServiceOverloadJob::dispatch($service->id);
            }
            $dispatched++;
        }

        $this->info(($dryRun ? '[dry-run] ' : '') . "Dispatched overload check for {$dispatched} service(s)");
        return self::SUCCESS;
    }
}
