<?php

namespace App\Console\Commands;

use App\Jobs\SendPushNotification;
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
            $this->ticketService->markAbsent($ticket);

            if ($ticket->user) {
                dispatch(new SendPushNotification(
                    $ticket->user->id,
                    'Ticket marqué absent',
                    'Votre ticket a été marqué absent suite au dépassement du délai autorisé.',
                    [
                        'ticket_id' => $ticket->id,
                        'service_id' => $ticket->service_id,
                        'type' => 'en_route_expired',
                    ]
                ));
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
