<?php

namespace App\Services;

use App\Models\Service;
use App\Models\ServiceException;
use App\Models\ServiceWorkingDay;
use Illuminate\Support\Carbon;

/**
 * Single source of truth for service availability.
 *
 * Combines the four configuration layers in order:
 *   1. Manual status     — Service::status (open|closed)
 *   2. Exceptions        — holidays / closures / partial unavailability for a given date
 *   3. Working days      — per-day on/off + per-day time overrides (ISO 1..7)
 *   4. Service hours     — Service::opening_time / closing_time as default
 *
 * Any rule violated short-circuits to "unavailable". All checks are backend-only.
 */
class ServiceAvailabilityService
{
    /**
     * Returns true if a ticket can be created on $service at $when.
     */
    public function isOpenAt(Service $service, Carbon $when): bool
    {
        return $this->reasonClosedAt($service, $when) === null;
    }

    /**
     * Returns a stable reason code when the service is closed at $when, or null when open.
     * Reason codes (used by API/UI to provide feedback to the end user):
     *   - manually_closed
     *   - holiday
     *   - exceptional_closure
     *   - temporarily_unavailable
     *   - day_off
     *   - outside_hours
     */
    public function reasonClosedAt(Service $service, Carbon $when): ?string
    {
        // 1) Manual status takes precedence
        if ($service->status !== 'open') {
            return 'manually_closed';
        }

        // 2) Exceptions for that exact date (or recurring on same month-day)
        $exception = $this->findExceptionForDate($service, $when);
        if ($exception) {
            if ($exception->is_closed) {
                return $exception->type === 'holiday' ? 'holiday' : 'exceptional_closure';
            }
            // Partial-day unavailability: only blocks during the window
            if ($exception->starts_at && $exception->ends_at) {
                $start = $this->combineDateAndTime($when, $exception->starts_at);
                $end   = $this->combineDateAndTime($when, $exception->ends_at);
                if ($when->between($start, $end)) {
                    return 'temporarily_unavailable';
                }
            }
        }

        // 3) Working day toggle
        $workingDay = $this->findWorkingDay($service, $when);
        if ($workingDay && !$workingDay->is_open) {
            return 'day_off';
        }

        // 4) Hours window (per-day override > service default)
        [$opening, $closing] = $this->effectiveHours($service, $workingDay);
        $openAt  = $this->combineDateAndTime($when, $opening);
        $closeAt = $this->combineDateAndTime($when, $closing);

        if ($when->lt($openAt) || $when->gte($closeAt)) {
            return 'outside_hours';
        }

        return null;
    }

    /**
     * Snapshot of availability for a given date (used by /availability endpoint).
     * Returns: ['is_open_now', 'reason_if_closed', 'opening_time', 'closing_time', 'next_opening']
     */
    public function snapshot(Service $service, ?Carbon $when = null): array
    {
        $when = $when ?? Carbon::now();
        $reason = $this->reasonClosedAt($service, $when);
        $workingDay = $this->findWorkingDay($service, $when);
        [$opening, $closing] = $this->effectiveHours($service, $workingDay);

        return [
            'is_open_now' => $reason === null,
            'reason_if_closed' => $reason,
            'opening_time' => $opening,
            'closing_time' => $closing,
            'next_opening' => $this->nextOpeningFrom($service, $when)?->toIso8601String(),
        ];
    }

    /**
     * Effective [opening_time, closing_time] (HH:MM:SS) for the day of $when:
     * per-day working-day override, else the service default hours.
     *
     * @return array{0:string,1:string}
     */
    public function effectiveHoursAt(Service $service, Carbon $when): array
    {
        return $this->effectiveHours($service, $this->findWorkingDay($service, $when));
    }

    /**
     * Compute the next opening datetime starting from $from (look ahead up to 14 days).
     */
    public function nextOpeningFrom(Service $service, Carbon $from): ?Carbon
    {
        if ($service->status !== 'open') {
            return null;
        }

        $cursor = $from->copy();
        for ($i = 0; $i < 14; $i++) {
            $day = $cursor->copy()->startOfDay();
            $exception = $this->findExceptionForDate($service, $day);
            $workingDay = $this->findWorkingDay($service, $day);

            $blockedAllDay = $exception && $exception->is_closed;
            $dayOff = $workingDay && !$workingDay->is_open;

            if (!$blockedAllDay && !$dayOff) {
                [$opening, $closing] = $this->effectiveHours($service, $workingDay);
                $openAt  = $this->combineDateAndTime($day, $opening);
                $closeAt = $this->combineDateAndTime($day, $closing);

                if ($i === 0 && $from->lt($closeAt)) {
                    // Today, and we haven't reached close yet
                    return $from->lt($openAt) ? $openAt : $from->copy();
                }
                if ($i > 0) {
                    return $openAt;
                }
            }

            $cursor = $cursor->copy()->addDay()->startOfDay();
        }
        return null;
    }

    /**
     * Ensure the 7 working-day rows exist for a service. Default: Mon-Fri open, Sat-Sun closed.
     */
    public function ensureWorkingDaysExist(Service $service): void
    {
        $existing = $service->workingDays()->pluck('day_of_week')->all();
        for ($day = 1; $day <= 7; $day++) {
            if (in_array($day, $existing, true)) continue;
            ServiceWorkingDay::create([
                'service_id'   => $service->id,
                'day_of_week'  => $day,
                'is_open'      => $day <= 5,
                'opening_time' => null,
                'closing_time' => null,
            ]);
        }
    }

    private function findExceptionForDate(Service $service, Carbon $when): ?ServiceException
    {
        $dateStr  = $when->toDateString();
        $monthDay = $when->format('m-d');

        // Cross-DB compatible: pull exact-date matches + all recurring rows, then filter in PHP.
        $candidates = $service->exceptions()
            ->where(function ($q) use ($dateStr) {
                $q->whereDate('date', $dateStr)
                  ->orWhere('recurring_yearly', true);
            })
            ->orderByDesc('is_closed')
            ->get();

        foreach ($candidates as $candidate) {
            $candidateDate = $candidate->date instanceof Carbon
                ? $candidate->date
                : Carbon::parse($candidate->date);

            if ($candidate->recurring_yearly) {
                if ($candidateDate->format('m-d') === $monthDay) {
                    return $candidate;
                }
                continue;
            }
            if ($candidateDate->toDateString() === $dateStr) {
                return $candidate;
            }
        }
        return null;
    }

    private function findWorkingDay(Service $service, Carbon $when): ?ServiceWorkingDay
    {
        $dow = $when->dayOfWeekIso; // 1..7 (Mon..Sun)
        return $service->workingDays()->where('day_of_week', $dow)->first();
    }

    /**
     * @return array{0:string,1:string} [opening_time, closing_time] in HH:MM:SS
     */
    private function effectiveHours(Service $service, ?ServiceWorkingDay $workingDay): array
    {
        $opening = $workingDay?->opening_time ?: ($service->opening_time ?? '08:00:00');
        $closing = $workingDay?->closing_time ?: ($service->closing_time ?? '18:00:00');
        return [$this->normalizeTime($opening), $this->normalizeTime($closing)];
    }

    private function normalizeTime(string $time): string
    {
        // Accept "HH:MM" or "HH:MM:SS"
        if (preg_match('/^\d{2}:\d{2}$/', $time)) {
            return $time . ':00';
        }
        return $time;
    }

    private function combineDateAndTime(Carbon $date, string $time): Carbon
    {
        return Carbon::createFromFormat(
            'Y-m-d H:i:s',
            $date->toDateString() . ' ' . $this->normalizeTime($time)
        );
    }
}
