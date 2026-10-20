<?php

namespace App\Console\Commands;

use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class TicketsExpireEnRoute extends Command
{
    protected $signature = 'tickets:expire-en-route {--dry-run}';
    protected $description = 'Expire en-route tickets whose grace period has elapsed';

    public function __construct(
        private TicketService $ticketService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $now = Carbon::now();

        $query = Ticket::query()
            ->with('user')
            ->where('status', 'en_route')
            ->whereNotNull('en_route_expires_at')
            ->where('en_route_expires_at', '<=', $now);

        $tickets = $query->get();
        $this->info(($dryRun ? '[dry-run] ' : '').'Expiring en-route tickets: '.$tickets->count());

        if ($dryRun) {
            return self::SUCCESS;
        }

        $affectedServiceIds = collect();

        foreach ($tickets as $ticket) {
            $affectedServiceIds->push($ticket->service_id);
            // markAbsent() envoie déjà la notification adaptée (absence temporaire ou
            // définitive) : un second push ici créait un doublon, parfois contradictoire.
            try {
                $this->ticketService->markAbsent($ticket);
            } catch (\InvalidArgumentException $e) {
                // Ticket clôturé entre-temps : rien à faire
            }
        }

        foreach ($affectedServiceIds->unique() as $serviceId) {
            $service = \App\Models\Service::find($serviceId);
            if ($service) {
                $this->ticketService->recomputePositions($service);
            }
        }

        return self::SUCCESS;
    }
}
