<?php

namespace App\Console\Commands;

use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class TicketsExpireStale extends Command
{
    protected $signature = 'tickets:expire-stale {--dry-run}';
    protected $description = 'Expire tickets whose valid_date has passed or whose service closing time has been reached';

    public function __construct(
        private TicketService $ticketService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $today = Carbon::today()->format('Y-m-d');

        // 1) Expire tickets with valid_date before today
        $activeStatuses = ['waiting', 'called', 'en_route', 'present', 'absent'];

        $staleQuery = Ticket::query()
            ->whereIn('status', $activeStatuses)
            ->whereNotNull('valid_date')
            ->whereDate('valid_date', '<', $today);

        $staleCount = $dryRun ? $staleQuery->count() : $staleQuery->update([
            'status' => 'expired',
            'position' => null,
            'eta_minutes' => null,
            'updated_at' => Carbon::now(),
        ]);

        $this->info(($dryRun ? '[dry-run] ' : '') . "Expired tickets with valid_date < {$today}: {$staleCount}");

        // 2) Safety net: expire tickets with no valid_date older than 24h
        $orphanQuery = Ticket::query()
            ->whereIn('status', $activeStatuses)
            ->whereNull('valid_date')
            ->where('created_at', '<', Carbon::now()->subHours(24));

        $orphanCount = $dryRun ? $orphanQuery->count() : $orphanQuery->update([
            'status' => 'expired',
            'position' => null,
            'eta_minutes' => null,
            'updated_at' => Carbon::now(),
        ]);

        $this->info(($dryRun ? '[dry-run] ' : '') . "Expired orphan tickets (>24h, no valid_date): {$orphanCount}");

        // 3) Recompute positions for affected services
        if (!$dryRun && ($staleCount > 0 || $orphanCount > 0)) {
            $affectedServiceIds = Ticket::query()
                ->whereIn('status', ['expired'])
                ->whereDate('updated_at', Carbon::today())
                ->distinct()
                ->pluck('service_id');

            foreach ($affectedServiceIds as $serviceId) {
                $service = \App\Models\Service::find($serviceId);
                if ($service) {
                    $this->ticketService->recomputePositions($service);
                }
            }

            $this->info("Recomputed positions for {$affectedServiceIds->count()} services");
        }

        return self::SUCCESS;
    }
}
