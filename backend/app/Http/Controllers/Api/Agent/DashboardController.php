<?php

namespace App\Http\Controllers\Api\Agent;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{
    /**
     * Statistiques du dashboard agent.
     */
    public function stats(Request $request)
    {
        $user = $request->user();

        // Récupérer les services assignés à l'agent
        $assignedServiceIds = $user->services()->pluck('services.id');

        if ($assignedServiceIds->isEmpty()) {
            return response()->json([
                'today_total' => 0,
                'today_called' => 0,
                'today_closed' => 0,
                'today_waiting' => 0,
                'today_absent' => 0,
                'avg_service_time' => null,
                'avg_wait_time' => null,
                'tickets_per_day' => 0,
                'active_services' => 0,
                'current_queue_size' => 0,
            ]);
        }

        $today = Carbon::today();
        $now = Carbon::now();

        // Statistiques du jour
        $todayStats = DB::table('tickets')
            ->whereIn('service_id', $assignedServiceIds)
            ->whereDate('created_at', $today)
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN status = 'called' THEN 1 ELSE 0 END) as called,
                SUM(CASE WHEN status = 'en_route' THEN 1 ELSE 0 END) as en_route,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
                SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
            ")
            ->first();

        // Temps moyen de service (temps entre called_at et closed_at)
        $avgServiceTime = DB::table('tickets')
            ->whereIn('service_id', $assignedServiceIds)
            ->whereNotNull('called_at')
            ->whereNotNull('closed_at')
            ->whereDate('closed_at', $today)
            ->selectRaw("AVG(EXTRACT(EPOCH FROM (closed_at - called_at)) / 60) as avg_time")
            ->value('avg_time');

        // Temps moyen d'attente (temps entre created_at et called_at)
        $avgWaitTime = DB::table('tickets')
            ->whereIn('service_id', $assignedServiceIds)
            ->whereNotNull('called_at')
            ->whereDate('called_at', $today)
            ->selectRaw("AVG(EXTRACT(EPOCH FROM (called_at - created_at)) / 60) as avg_time")
            ->value('avg_time');

        // Tickets par jour (moyenne sur 7 jours)
        $ticketsLast7Days = DB::table('tickets')
            ->whereIn('service_id', $assignedServiceIds)
            ->where('created_at', '>=', Carbon::now()->subDays(7))
            ->count();
        $ticketsPerDay = round($ticketsLast7Days / 7, 1);

        // Services actifs
        $activeServices = Service::whereIn('id', $assignedServiceIds)
            ->where('status', 'open')
            ->count();

        // File actuelle (tickets en attente)
        $currentQueueSize = DB::table('tickets')
            ->whereIn('service_id', $assignedServiceIds)
            ->whereIn('status', ['waiting', 'created', 'en_route', 'present'])
            ->where('created_at', '>=', Carbon::now()->subHours(24))
            ->count();

        return response()->json([
            'today_total' => (int) ($todayStats->total ?? 0),
            'today_called' => (int) ($todayStats->called ?? 0),
            'today_closed' => (int) ($todayStats->closed ?? 0),
            'today_waiting' => (int) ($todayStats->waiting ?? 0),
            'today_en_route' => (int) ($todayStats->en_route ?? 0),
            'today_present' => (int) ($todayStats->present ?? 0),
            'today_absent' => (int) ($todayStats->absent ?? 0),
            'avg_service_time' => $avgServiceTime ? (int) round($avgServiceTime) : null,
            'avg_wait_time' => $avgWaitTime ? (int) round($avgWaitTime) : null,
            'tickets_per_day' => $ticketsPerDay,
            'active_services' => $activeServices,
            'current_queue_size' => $currentQueueSize,
        ]);
    }

    /**
     * Tickets du jour pour l'agent.
     */
    public function todayTickets(Request $request)
    {
        $user = $request->user();
        $assignedServiceIds = $user->services()->pluck('services.id');

        if ($assignedServiceIds->isEmpty()) {
            return response()->json([]);
        }

        $today = Carbon::today();

        $tickets = Ticket::query()
            ->whereIn('service_id', $assignedServiceIds)
            ->whereDate('created_at', $today)
            ->with(['service', 'user', 'counter'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json($tickets->map(function ($ticket) {
            return [
                'id' => $ticket->id,
                'number' => $ticket->number,
                'status' => $ticket->status,
                'priority' => $ticket->priority,
                'position' => $ticket->position,
                'service_id' => $ticket->service_id,
                'service_name' => $ticket->service?->name,
                'user_name' => $ticket->user?->name,
                'counter_name' => $ticket->counter?->name,
                'called_at' => $ticket->called_at?->toDateTimeString(),
                'closed_at' => $ticket->closed_at?->toDateTimeString(),
                'created_at' => $ticket->created_at->toDateTimeString(),
            ];
        }));
    }

    /**
     * File d'attente actuelle pour l'agent.
     */
    public function currentQueue(Request $request)
    {
        $user = $request->user();
        $assignedServiceIds = $user->services()->pluck('services.id');

        if ($assignedServiceIds->isEmpty()) {
            return response()->json([
                'services' => [],
                'total_waiting' => 0,
            ]);
        }

        // Tickets en attente par service
        $services = Service::whereIn('id', $assignedServiceIds)
            ->withCount(['tickets as waiting_count' => function ($q) {
                $q->whereIn('status', ['waiting', 'created'])
                  ->where('created_at', '>=', Carbon::now()->subHours(24));
            }])
            ->get();

        // Tickets en attente
        $waitingTickets = Ticket::query()
            ->whereIn('service_id', $assignedServiceIds)
            ->whereIn('status', ['waiting', 'created'])
            ->where('created_at', '>=', Carbon::now()->subHours(24))
            ->with(['service', 'user'])
            ->orderBy('priority', 'desc')
            ->orderBy('created_at')
            ->limit(20)
            ->get();

        return response()->json([
            'services' => $services->map(function ($s) {
                return [
                    'id' => $s->id,
                    'name' => $s->name,
                    'status' => $s->status,
                    'waiting_count' => $s->waiting_count,
                ];
            }),
            'tickets' => $waitingTickets->map(function ($t) {
                return [
                    'id' => $t->id,
                    'number' => $t->number,
                    'status' => $t->status,
                    'priority' => $t->priority,
                    'position' => $t->position,
                    'service_id' => $t->service_id,
                    'service_name' => $t->service?->name,
                    'user_name' => $t->user?->name,
                    'wait_time_minutes' => $t->created_at->diffInMinutes(Carbon::now()),
                    'created_at' => $t->created_at->toDateTimeString(),
                ];
            }),
            'total_waiting' => $waitingTickets->count(),
        ]);
    }

    /**
     * Performance de l'agent sur les 7 derniers jours.
     */
    public function performance(Request $request)
    {
        $user = $request->user();
        $assignedServiceIds = $user->services()->pluck('services.id');

        if ($assignedServiceIds->isEmpty()) {
            return response()->json([
                'daily' => [],
                'total_closed' => 0,
                'total_absent' => 0,
                'avg_service_time' => null,
            ]);
        }

        // Performance quotidienne sur 7 jours
        $dailyStats = DB::table('tickets')
            ->whereIn('service_id', $assignedServiceIds)
            ->where('created_at', '>=', Carbon::now()->subDays(7))
            ->selectRaw("
                DATE(created_at) as date,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
            ")
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Totals
        $totals = DB::table('tickets')
            ->whereIn('service_id', $assignedServiceIds)
            ->where('created_at', '>=', Carbon::now()->subDays(7))
            ->selectRaw("
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as total_closed,
                SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as total_absent
            ")
            ->first();

        // Temps moyen de service - PostgreSQL compatible
        $avgServiceTime = DB::table('tickets')
            ->whereIn('service_id', $assignedServiceIds)
            ->whereNotNull('called_at')
            ->whereNotNull('closed_at')
            ->where('closed_at', '>=', Carbon::now()->subDays(7))
            ->selectRaw("AVG(EXTRACT(EPOCH FROM (closed_at - called_at)) / 60) as avg_time")
            ->value('avg_time');

        return response()->json([
            'daily' => $dailyStats->map(function ($d) {
                return [
                    'date' => $d->date,
                    'total' => (int) $d->total,
                    'closed' => (int) $d->closed,
                    'absent' => (int) $d->absent,
                ];
            }),
            'total_closed' => (int) ($totals->total_closed ?? 0),
            'total_absent' => (int) ($totals->total_absent ?? 0),
            'avg_service_time' => $avgServiceTime ? (int) round($avgServiceTime) : null,
        ]);
    }
}
