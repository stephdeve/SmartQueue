<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Service;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Support\Carbon;

class AgentQueueController extends Controller
{
    use AuthorizesRequests;

    /**
     * Vue complète temps réel de la file d'un service (waiting/called/absent).
     */
    public function index(Service $service, Request $request)
    {
        $this->authorize('manage', $service);

        $items = Ticket::query()
            ->where('service_id', $service->id)
            ->whereIn('status', ['waiting','called','absent'])
            ->where('created_at', '>=', Carbon::now()->subHours(24))
            ->orderByRaw("CASE status WHEN 'called' THEN 1 WHEN 'waiting' THEN 2 ELSE 3 END")
            ->orderByRaw("CASE priority WHEN 'vip' THEN 3 WHEN 'high' THEN 2 ELSE 1 END DESC")
            ->orderBy('created_at')
            ->with(['user','counter'])
            ->get();

        return response()->json([
            'service_id' => $service->id,
            'tickets' => $items->map(function (Ticket $t) {
                return [
                    'id' => $t->id,
                    'number' => $t->number,
                    'status' => $t->status,
                    'priority' => $t->priority,
                    'position' => $t->position,
                    'created_at' => $t->created_at->toDateTimeString(),
                    'called_at' => optional($t->called_at)->toDateTimeString(),
                    'absent_at' => optional($t->absent_at)->toDateTimeString(),
                    'user' => $t->user ? [
                        'id' => $t->user->id,
                        'name' => $t->user->name,
                        'phone' => $t->user->phone,
                    ] : null,
                    'counter' => $t->counter ? [
                        'id' => $t->counter->id,
                        'name' => $t->counter->name,
                    ] : null,
                ];
            }),
        ]);
    }
}
