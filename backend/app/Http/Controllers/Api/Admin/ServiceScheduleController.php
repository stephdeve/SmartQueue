<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\TicketResource;
use App\Models\Service;
use App\Models\ServiceException;
use App\Models\Ticket;
use App\Services\ServiceAvailabilityService;
use App\Services\SmartQueueEngine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Admin endpoints to configure a service's schedule:
 *  - opening/closing hours
 *  - working days (Mon..Sun activation + per-day time overrides)
 *  - holidays / exceptional closures / temporary unavailabilities
 *  - average processing time
 *
 * All business rules live server-side; the frontend only edits this configuration.
 */
class ServiceScheduleController extends Controller
{
    public function __construct(
        private readonly ServiceAvailabilityService $availability,
        private readonly SmartQueueEngine $smartQueue,
    ) {
    }

    /**
     * Find a service scoped to the admin's establishment (when scoping is active).
     */
    private function findScopedService(Request $request, int $serviceId): Service
    {
        $scopedId = $request->attributes->get('scoped_establishment_id');
        return Service::query()
            ->when($scopedId, fn ($q) => $q->where('establishment_id', (int) $scopedId))
            ->findOrFail($serviceId);
    }

    /**
     * GET /api/admin/services/{service}/schedule
     * Full schedule snapshot.
     */
    public function show(Request $request, int $serviceId)
    {
        $service = $this->findScopedService($request, $serviceId);
        $this->availability->ensureWorkingDaysExist($service);
        $service->refresh()->load(['workingDays', 'exceptions']);

        return response()->json([
            'data' => [
                'service_id' => $service->id,
                'name' => $service->name,
                'status' => $service->status,
                'opening_time' => $service->opening_time,
                'closing_time' => $service->closing_time,
                'avg_service_time_minutes' => (int) $service->avg_service_time_minutes,
                'working_days' => $service->workingDays->map(fn ($wd) => [
                    'id' => $wd->id,
                    'day_of_week' => (int) $wd->day_of_week,
                    'is_open' => (bool) $wd->is_open,
                    'opening_time' => $wd->opening_time,
                    'closing_time' => $wd->closing_time,
                ])->values(),
                'exceptions' => $service->exceptions->map(fn ($e) => [
                    'id' => $e->id,
                    'date' => $e->date?->toDateString(),
                    'type' => $e->type,
                    'label' => $e->label,
                    'is_closed' => (bool) $e->is_closed,
                    'starts_at' => $e->starts_at,
                    'ends_at' => $e->ends_at,
                    'recurring_yearly' => (bool) $e->recurring_yearly,
                ])->values(),
                'availability' => $this->availability->snapshot($service),
                'capacity' => $this->smartQueue->loadSnapshot($service),
            ],
        ]);
    }

    /**
     * PUT /api/admin/services/{service}/schedule
     * Bulk update of service hours, avg processing time, and working days.
     * Body: {
     *   opening_time, closing_time, avg_service_time_minutes,
     *   working_days: [ { day_of_week, is_open, opening_time?, closing_time? } ]
     * }
     */
    public function update(Request $request, int $serviceId)
    {
        $service = $this->findScopedService($request, $serviceId);

        $data = $request->validate([
            'opening_time' => ['sometimes','date_format:H:i'],
            'closing_time' => ['sometimes','date_format:H:i','after:opening_time'],
            'avg_service_time_minutes' => ['sometimes','integer','min:1','max:240'],

            'working_days' => ['sometimes','array','size:7'],
            'working_days.*.day_of_week' => ['required_with:working_days','integer','between:1,7'],
            'working_days.*.is_open' => ['required_with:working_days','boolean'],
            'working_days.*.opening_time' => ['nullable','date_format:H:i'],
            'working_days.*.closing_time' => ['nullable','date_format:H:i'],
        ]);

        DB::transaction(function () use ($service, $data) {
            $serviceUpdates = [];
            if (array_key_exists('opening_time', $data)) {
                $serviceUpdates['opening_time'] = $data['opening_time'] . ':00';
            }
            if (array_key_exists('closing_time', $data)) {
                $serviceUpdates['closing_time'] = $data['closing_time'] . ':00';
            }
            if (array_key_exists('avg_service_time_minutes', $data)) {
                $serviceUpdates['avg_service_time_minutes'] = $data['avg_service_time_minutes'];
            }
            if (!empty($serviceUpdates)) {
                $service->update($serviceUpdates);
            }

            if (!empty($data['working_days'])) {
                foreach ($data['working_days'] as $wd) {
                    // Cross-day window check
                    if (!empty($wd['opening_time']) && !empty($wd['closing_time'])
                        && $wd['opening_time'] >= $wd['closing_time']) {
                        abort(422, "Working day {$wd['day_of_week']}: opening must be before closing");
                    }
                    $service->workingDays()->updateOrCreate(
                        ['day_of_week' => $wd['day_of_week']],
                        [
                            'is_open'      => (bool) $wd['is_open'],
                            'opening_time' => isset($wd['opening_time']) ? $wd['opening_time'].':00' : null,
                            'closing_time' => isset($wd['closing_time']) ? $wd['closing_time'].':00' : null,
                        ]
                    );
                }
            }
        });

        return $this->show($request, $serviceId);
    }

    /**
     * POST /api/admin/services/{service}/exceptions
     * Add a holiday / exceptional closure / temporary unavailability.
     */
    public function storeException(Request $request, int $serviceId)
    {
        $service = $this->findScopedService($request, $serviceId);

        $data = $request->validate([
            'date' => ['required','date'],
            'type' => ['nullable','in:holiday,closure,unavailable'],
            'label' => ['nullable','string','max:160'],
            'is_closed' => ['nullable','boolean'],
            'starts_at' => ['nullable','date_format:H:i'],
            'ends_at' => ['nullable','date_format:H:i','after:starts_at'],
            'recurring_yearly' => ['nullable','boolean'],
        ]);

        $type = $data['type'] ?? 'holiday';
        $isClosed = array_key_exists('is_closed', $data) ? (bool) $data['is_closed'] : ($type !== 'unavailable');

        if (!$isClosed && (empty($data['starts_at']) || empty($data['ends_at']))) {
            abort(422, 'Partial unavailability requires both starts_at and ends_at');
        }

        $exception = ServiceException::create([
            'service_id' => $service->id,
            'date' => $data['date'],
            'type' => $type,
            'label' => $data['label'] ?? null,
            'is_closed' => $isClosed,
            'starts_at' => isset($data['starts_at']) ? $data['starts_at'].':00' : null,
            'ends_at'   => isset($data['ends_at'])   ? $data['ends_at'].':00'   : null,
            'recurring_yearly' => (bool) ($data['recurring_yearly'] ?? false),
        ]);

        return response()->json(['data' => $exception], 201);
    }

    /**
     * PUT /api/admin/services/{service}/exceptions/{exception}
     */
    public function updateException(Request $request, int $serviceId, int $exceptionId)
    {
        $service = $this->findScopedService($request, $serviceId);
        $exception = ServiceException::where('service_id', $service->id)->findOrFail($exceptionId);

        $data = $request->validate([
            'date' => ['sometimes','date'],
            'type' => ['sometimes','in:holiday,closure,unavailable'],
            'label' => ['sometimes','nullable','string','max:160'],
            'is_closed' => ['sometimes','boolean'],
            'starts_at' => ['sometimes','nullable','date_format:H:i'],
            'ends_at' => ['sometimes','nullable','date_format:H:i','after:starts_at'],
            'recurring_yearly' => ['sometimes','boolean'],
        ]);

        if (array_key_exists('starts_at', $data)) {
            $data['starts_at'] = $data['starts_at'] ? $data['starts_at'].':00' : null;
        }
        if (array_key_exists('ends_at', $data)) {
            $data['ends_at'] = $data['ends_at'] ? $data['ends_at'].':00' : null;
        }

        $exception->update($data);
        return response()->json(['data' => $exception->fresh()]);
    }

    /**
     * DELETE /api/admin/services/{service}/exceptions/{exception}
     */
    public function destroyException(Request $request, int $serviceId, int $exceptionId)
    {
        $service = $this->findScopedService($request, $serviceId);
        $exception = ServiceException::where('service_id', $service->id)->findOrFail($exceptionId);
        $exception->delete();
        return response()->json(['message' => 'Deleted']);
    }

    /**
     * GET /api/admin/services/{service}/deferred-queue
     * Returns tickets auto-deferred by the SmartQueueEngine, grouped by target date.
     * Useful to give the admin/agent visibility on what's already booked for upcoming days.
     */
    public function deferredQueue(Request $request, int $serviceId)
    {
        $service = $this->findScopedService($request, $serviceId);

        $tickets = Ticket::query()
            ->where('service_id', $service->id)
            ->where('auto_deferred', true)
            ->where('status', 'waiting')
            ->whereDate('valid_date', '>=', now()->toDateString())
            ->orderBy('valid_date')
            ->orderBy('position')
            ->orderBy('created_at')
            ->with(['service.establishment', 'user'])
            ->get();

        $byDate = $tickets->groupBy(fn ($t) => $t->valid_date?->toDateString())
            ->map(fn ($group, $date) => [
                'date' => $date,
                'count' => $group->count(),
                'tickets' => TicketResource::collection($group)->resolve(),
            ])
            ->values();

        return response()->json([
            'service_id' => $service->id,
            'total' => $tickets->count(),
            'days' => $byDate,
        ]);
    }
}
