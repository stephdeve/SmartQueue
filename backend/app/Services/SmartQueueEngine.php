<?php

namespace App\Services;

use App\Models\Service;
use App\Models\Ticket;
use Illuminate\Support\Carbon;

/**
 * Smart queue engine.
 *
 * Decides whether an incoming ticket goes into today's ACTIVE queue or is
 * automatically routed to a DEFERRED queue (next valid open day). The decision
 * is computed entirely server-side.
 *
 * Core comparison:
 *      time_remaining_before_close  vs  waiting_count * avg_service_time
 *
 * When `time_remaining < load`, the engine enters the critical zone and
 * deferes all new tickets to the next opening.
 *
 * Decision rules:
 *  - Service::status === 'closed' (manual)              → reject (admin override)
 *  - Day off / holiday / full-day exception             → defer to next open day
 *  - Currently past today's closing time                → defer to next open day
 *  - Inside today's mid-day partial-closure window      → defer to next open day
 *  - Now < intelligent_cutoff (capacity still fits)     → active today
 *  - Now >= intelligent_cutoff (critical zone)          → defer to next open day
 *
 * Where:
 *      intelligent_cutoff = today_close - (today_waiting_count * avg_service_time)
 */
class SmartQueueEngine
{
    public function __construct(private readonly ServiceAvailabilityService $availability)
    {
    }

    /**
     * @return array{
     *     mode: 'active'|'deferred',
     *     valid_date: string,
     *     reason: string|null,
     *     cutoff_at: string|null
     * }
     */
    public function decidePlacement(Service $service, Carbon $when): array
    {
        // Hard reject: admin manually closed the service. Auto-defer would be
        // misleading because no schedule predicts the reopening.
        if ($service->status !== 'open') {
            abort(422, 'Service is manually closed, please try again later');
        }

        $reason = $this->availability->reasonClosedAt($service, $when);

        // Full-day unavailability — defer to next opening
        if (in_array($reason, ['holiday', 'exceptional_closure', 'day_off'], true)) {
            return $this->defer($service, $when, $reason);
        }

        // Mid-day partial unavailability — defer to next opening (today after window or next day)
        if ($reason === 'temporarily_unavailable') {
            return $this->defer($service, $when, 'temporarily_unavailable');
        }

        // Outside hours (status open + working day, but before/after window)
        if ($reason === 'outside_hours') {
            $window = $this->todaysWindow($service, $when);
            if ($window && $when->lt($window['close'])) {
                // Before opening today: queue active so the user is in line when doors open
                return [
                    'mode' => 'active',
                    'valid_date' => $when->toDateString(),
                    'reason' => null,
                    'cutoff_at' => $this->intelligentCutoff($service, $when, $window)->toIso8601String(),
                ];
            }
            // After today's close → defer
            return $this->defer($service, $when, 'past_cutoff');
        }

        // We are inside the open window — evaluate intelligent cutoff
        $window = $this->todaysWindow($service, $when);
        $cutoffAt = $this->intelligentCutoff($service, $when, $window);

        if ($when->lt($cutoffAt)) {
            return [
                'mode' => 'active',
                'valid_date' => $when->toDateString(),
                'reason' => null,
                'cutoff_at' => $cutoffAt->toIso8601String(),
            ];
        }

        // Critical zone: not enough time to finish before closing
        return $this->defer($service, $when, 'critical_zone');
    }

    /**
     * Compute the intelligent cutoff (datetime today) past which new tickets cannot
     * be processed before closing given the current waiting load.
     */
    public function intelligentCutoff(Service $service, Carbon $when, ?array $window = null): Carbon
    {
        $window = $window ?? $this->todaysWindow($service, $when);
        if (!$window) {
            return $when->copy();
        }
        $avg = max(1, (int) ($service->avg_service_time_minutes ?? 5));
        $waitingLoad = Ticket::query()
            ->where('service_id', $service->id)
            ->where('status', 'waiting')
            ->whereDate('valid_date', $when->toDateString())
            ->count();
        $cutoff = $window['close']->copy()->subMinutes($waitingLoad * $avg);
        // Never let cutoff go before today's opening
        return $cutoff->lt($window['open']) ? $window['open']->copy() : $cutoff;
    }

    /**
     * Snapshot used by /availability — describes the current capacity state.
     *
     * @return array{
     *     intelligent_cutoff_at: string|null,
     *     critical_zone: bool,
     *     waiting_count_today: int,
     *     estimated_load_minutes: int
     * }
     */
    public function loadSnapshot(Service $service, ?Carbon $when = null): array
    {
        $when = $when ?? Carbon::now();
        $window = $this->todaysWindow($service, $when);
        if (!$window) {
            return [
                'intelligent_cutoff_at' => null,
                'critical_zone' => false,
                'waiting_count_today' => 0,
                'estimated_load_minutes' => 0,
            ];
        }
        $cutoffAt = $this->intelligentCutoff($service, $when, $window);
        $avg = max(1, (int) ($service->avg_service_time_minutes ?? 5));
        $waitingLoad = Ticket::query()
            ->where('service_id', $service->id)
            ->where('status', 'waiting')
            ->whereDate('valid_date', $when->toDateString())
            ->count();
        return [
            'intelligent_cutoff_at' => $cutoffAt->toIso8601String(),
            'critical_zone' => $when->gte($cutoffAt),
            'waiting_count_today' => $waitingLoad,
            'estimated_load_minutes' => $waitingLoad * $avg,
        ];
    }

    /**
     * @return array{mode:'deferred',valid_date:string,reason:string,cutoff_at:null}
     */
    private function defer(Service $service, Carbon $when, string $reason): array
    {
        // Start lookup tomorrow when the failure is full-day (no point retrying today).
        // For partial unavailability, the next opening may still be later today.
        $from = match ($reason) {
            'temporarily_unavailable' => $when->copy(),
            default                   => $when->copy()->addDay()->startOfDay(),
        };
        $next = $this->availability->nextOpeningFrom($service, $from);
        if (!$next) {
            abort(422, 'No upcoming opening found for this service');
        }
        return [
            'mode' => 'deferred',
            'valid_date' => $next->toDateString(),
            'reason' => $reason,
            'cutoff_at' => null,
        ];
    }

    /**
     * Today's effective open/close datetimes, accounting for working-day overrides.
     * Returns null when today is fully closed.
     */
    private function todaysWindow(Service $service, Carbon $when): ?array
    {
        $snapshot = $this->availability->snapshot($service, $when);
        if (!$snapshot['opening_time'] || !$snapshot['closing_time']) {
            return null;
        }
        return [
            'open'  => $this->combine($when, $snapshot['opening_time']),
            'close' => $this->combine($when, $snapshot['closing_time']),
        ];
    }

    private function combine(Carbon $date, string $time): Carbon
    {
        $t = preg_match('/^\d{2}:\d{2}$/', $time) ? $time . ':00' : $time;
        return Carbon::createFromFormat('Y-m-d H:i:s', $date->toDateString() . ' ' . $t);
    }
}
