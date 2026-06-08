<?php

namespace App\Console\Commands;

use App\Jobs\CloseServiceDayJob;
use App\Models\Service;
use App\Services\ServiceAvailabilityService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Scheduler sweep: dispatch CloseServiceDayJob for every service that has
 * reached or passed its closing time today AND still has unserved tickets
 * (waiting/called/etc.) lying around.
 *
 * Restricting by "has work to do" keeps the sweep cheap when many services
 * close at the same time.
 */
class QueueCloseDay extends Command
{
    protected $signature = 'queue:close-day {--service_id=} {--dry-run}';
    protected $description = 'Close out the day for services past their closing time and expire unserved tickets';

    public function handle(ServiceAvailabilityService $availability): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $serviceIdOpt = $this->option('service_id');

        $services = Service::query()
            ->where('status', 'open')
            ->when($serviceIdOpt, fn ($q) => $q->where('id', (int) $serviceIdOpt))
            ->whereExists(function ($sub) {
                $sub->select('id')->from('tickets')
                    ->whereColumn('tickets.service_id', 'services.id')
                    ->whereIn('status', ['waiting','called','en_route','present','absent'])
                    ->whereDate('valid_date', Carbon::today())
                    ->where('auto_deferred', false);
            })
            ->with(['workingDays', 'exceptions'])
            ->get();

        $now = Carbon::now();
        $dispatched = 0;
        foreach ($services as $service) {
            $snapshot = $availability->snapshot($service, $now);
            if (!$snapshot['closing_time']) continue;

            $closeAt = Carbon::createFromFormat(
                'Y-m-d H:i:s',
                $now->toDateString() . ' ' . $this->normalize($snapshot['closing_time'])
            );
            if ($now->lt($closeAt)) continue;

            if ($dryRun) {
                $this->line("[dry-run] would close-day for service {$service->id}");
            } else {
                CloseServiceDayJob::dispatch($service->id);
            }
            $dispatched++;
        }

        $this->info(($dryRun ? '[dry-run] ' : '') . "Dispatched close-day for {$dispatched} service(s)");
        return self::SUCCESS;
    }

    private function normalize(string $time): string
    {
        return preg_match('/^\d{2}:\d{2}$/', $time) ? $time . ':00' : $time;
    }
}
