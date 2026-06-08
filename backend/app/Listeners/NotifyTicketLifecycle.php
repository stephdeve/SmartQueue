<?php

namespace App\Listeners;

use App\Events\TicketLifecycle\TicketActivated;
use App\Events\TicketLifecycle\TicketCreated;
use App\Events\TicketLifecycle\TicketDeferred;
use App\Events\TicketLifecycle\TicketExpiredAuto;
use App\Jobs\SendPushNotification;
use App\Models\Ticket;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Log;

/**
 * Single queued listener that fans every lifecycle event into a push notification
 * (in-app notification + FCM). Resolves the Ticket inside the listener so events
 * stay light and safe to serialize.
 *
 * Reason-code → end-user message mapping lives here so domain code (engine, jobs)
 * stays language-neutral.
 */
class NotifyTicketLifecycle implements ShouldQueue
{
    public function handleCreated(TicketCreated $event): void
    {
        $ticket = $this->loadTicket($event->ticketId);
        if (!$ticket || !$ticket->user_id) return;

        if ($event->isDeferred) {
            $when = $this->formatDate($ticket->valid_date?->toDateString());
            $reason = $this->deferReasonLabel($event->deferReason);
            $title = 'Ticket reporté';
            $body  = "Votre ticket {$ticket->number} a été reporté au {$when}. {$reason}";
            $type  = 'ticket_deferred';
        } else {
            $title = 'Ticket créé';
            $body  = "Votre ticket {$ticket->number} a été créé. Position #{$ticket->position}.";
            $type  = 'ticket_created';
        }

        dispatch(new SendPushNotification(
            $ticket->user_id,
            $title,
            $body,
            [
                'type' => $type,
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'valid_date' => $ticket->valid_date?->toDateString(),
                'auto_deferred' => $ticket->auto_deferred,
                'defer_reason' => $event->deferReason,
            ]
        ));
    }

    public function handleDeferred(TicketDeferred $event): void
    {
        $ticket = $this->loadTicket($event->ticketId);
        if (!$ticket || !$ticket->user_id) return;

        $when = $this->formatDate($event->newValidDate);
        $reason = $this->deferReasonLabel($event->reason);
        dispatch(new SendPushNotification(
            $ticket->user_id,
            'Ticket reporté au prochain jour ouvrable',
            "Votre ticket {$ticket->number} ne pourra plus être servi aujourd'hui. {$reason} Il est reporté au {$when}.",
            [
                'type' => 'ticket_deferred',
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'previous_valid_date' => $event->previousValidDate,
                'new_valid_date' => $event->newValidDate,
                'defer_reason' => $event->reason,
            ]
        ));
    }

    public function handleActivated(TicketActivated $event): void
    {
        $ticket = $this->loadTicket($event->ticketId);
        if (!$ticket || !$ticket->user_id) return;

        dispatch(new SendPushNotification(
            $ticket->user_id,
            'Votre ticket est actif',
            "Le service est ouvert. Votre ticket {$ticket->number} est en position #{$event->position}.",
            [
                'type' => 'ticket_activated',
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'position' => $event->position,
            ]
        ));
    }

    public function handleExpired(TicketExpiredAuto $event): void
    {
        $ticket = $this->loadTicket($event->ticketId);
        if (!$ticket || !$ticket->user_id) return;

        $body = $event->reason === 'service_closed'
            ? "Le service a fermé avant que votre ticket {$ticket->number} ne soit appelé. Il a expiré."
            : "Votre ticket {$ticket->number} a expiré.";

        dispatch(new SendPushNotification(
            $ticket->user_id,
            'Ticket expiré',
            $body,
            [
                'type' => 'ticket_expired',
                'ticket_id' => $ticket->id,
                'service_id' => $ticket->service_id,
                'reason' => $event->reason,
            ]
        ));
    }

    private function loadTicket(int $ticketId): ?Ticket
    {
        try {
            return Ticket::find($ticketId);
        } catch (\Throwable $e) {
            Log::warning('NotifyTicketLifecycle: failed to load ticket', [
                'ticket_id' => $ticketId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    private function formatDate(?string $date): string
    {
        if (!$date) return 'prochain jour ouvrable';
        try {
            return \Illuminate\Support\Carbon::parse($date)->locale('fr')->isoFormat('dddd D MMMM');
        } catch (\Throwable $e) {
            return $date;
        }
    }

    private function deferReasonLabel(?string $reason): string
    {
        return match ($reason) {
            'critical_zone'           => "La file ne peut plus absorber de tickets aujourd'hui.",
            'past_cutoff'             => "L'heure limite intelligente de la journée est dépassée.",
            'non_working_day',
            'day_off'                 => "Le service n'ouvre pas ce jour.",
            'holiday'                 => "Le service est fermé pour un jour férié.",
            'exceptional_closure'     => "Le service est exceptionnellement fermé.",
            'temporarily_unavailable' => "Le service est temporairement indisponible.",
            default                   => '',
        };
    }
}
