<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TicketController extends Controller
{
    /**
     * Liste des tickets avec filtres pour admin/agent.
     *
     * Query params:
     * - status: waiting|called|closed|absent|cancelled|expired|all
     * - service_id: ID du service (optionnel)
     * - from: date début (ISO ou Y-m-d)
     * - to: date fin (ISO ou Y-m-d)
     * - period: today|week|month (raccourci pour from/to)
     * - per_page: nombre par page (défaut 20, max 100)
     * - page: numéro de page
     * - with_details: inclure les détails utilisateur (défaut false)
     */
    public function index(Request $request)
    {
        $scopedId = $request->attributes->get('scoped_establishment_id');
        $user = $request->user();

        // Pour les agents, récupérer l'établissement via l'utilisateur
        if ($user->role === 'agent' && !$scopedId) {
            $scopedId = $user->establishment_id;
        }

        // Déterminer la période
        $period = $request->query('period', 'today');
        $from = $request->query('from');
        $to = $request->query('to');

        if (!$from || !$to) {
            switch ($period) {
                case 'week':
                    $from = now()->startOfWeek()->toDateString();
                    $to = now()->endOfWeek()->toDateString();
                    break;
                case 'month':
                    $from = now()->startOfMonth()->toDateString();
                    $to = now()->endOfMonth()->toDateString();
                    break;
                case 'today':
                default:
                    $from = now()->startOfDay()->toDateString();
                    $to = now()->endOfDay()->toDateString();
                    break;
            }
        }

        $from = now()->parse($from)->startOfDay();
        $to = now()->parse($to)->endOfDay();

        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);
        $withDetails = $request->boolean('with_details', false);

        // Construire la requête
        $query = Ticket::query()
            ->join('services', 'services.id', '=', 'tickets.service_id')
            ->whereBetween('tickets.created_at', [$from, $to]);

        // Filtrer par établissement (admin) ou services assignés (agent)
        if ($user->role === 'admin' && !empty($scopedId)) {
            $query->where('services.establishment_id', (int) $scopedId);
        } elseif ($user->role === 'agent') {
            // Agent: seulement les services auxquels il est assigné
            $assignedServiceIds = $user->services()->pluck('services.id');
            if ($assignedServiceIds->isEmpty()) {
                // Si l'agent n'a pas de services assignés, retourner une liste vide
                return response()->json([
                    'data' => [],
                    'meta' => [
                        'current_page' => 1,
                        'per_page' => $perPage,
                        'total' => 0,
                        'last_page' => 1,
                        'from' => $from->toDateTimeString(),
                        'to' => $to->toDateTimeString(),
                        'period' => $period,
                    ],
                ]);
            }
            $query->whereIn('tickets.service_id', $assignedServiceIds);
        }

        // Filtre par service
        if ($request->filled('service_id')) {
            $query->where('tickets.service_id', (int) $request->query('service_id'));
        }

        // Filtre par statut
        $status = $request->query('status');
        if ($status && $status !== 'all') {
            if ($status === 'active') {
                $query->whereIn('tickets.status', ['waiting', 'called', 'created']);
            } elseif ($status === 'completed') {
                $query->whereIn('tickets.status', ['closed', 'cancelled', 'served', 'expired', 'absent']);
            } else {
                $query->where('tickets.status', $status);
            }
        }

        // Sélection et tri
        $query->select([
            'tickets.id',
            'tickets.number',
            'tickets.status',
            'tickets.priority',
            'tickets.position',
            'tickets.service_id',
            'tickets.counter_id',
            'tickets.called_at',
            'tickets.closed_at',
            'tickets.absent_at',
            'tickets.created_at',
            'tickets.updated_at',
            'services.name as service_name',
            'services.status as service_status',
        ]);

        $query->orderByDesc('tickets.created_at');

        // Pagination
        $paginator = $query->paginate($perPage);

        // Transformer les résultats
        $tickets = collect($paginator->items())->map(function ($ticket) use ($withDetails) {
            $data = [
                'id' => $ticket->id,
                'number' => $ticket->number,
                'status' => $ticket->status,
                'priority' => $ticket->priority,
                'position' => $ticket->position,
                'service' => [
                    'id' => $ticket->service_id,
                    'name' => $ticket->service_name,
                    'status' => $ticket->service_status,
                ],
                'counter_id' => $ticket->counter_id,
                'called_at' => $ticket->called_at?->toDateTimeString(),
                'closed_at' => $ticket->closed_at?->toDateTimeString(),
                'absent_at' => $ticket->absent_at?->toDateTimeString(),
                'created_at' => $ticket->created_at->toDateTimeString(),
                'updated_at' => $ticket->updated_at->toDateTimeString(),
            ];

            if ($withDetails) {
                $fullTicket = Ticket::with(['user', 'counter'])->find($ticket->id);
                $data['user'] = $fullTicket->user ? [
                    'id' => $fullTicket->user->id,
                    'name' => $fullTicket->user->name,
                    'phone' => $fullTicket->user->phone,
                    'email' => $fullTicket->user->email,
                ] : null;
                $data['counter'] = $fullTicket->counter ? [
                    'id' => $fullTicket->counter->id,
                    'name' => $fullTicket->counter->name,
                ] : null;
            }

            return $data;
        });

        return response()->json([
            'data' => $tickets,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
                'from' => $from->toDateTimeString(),
                'to' => $to->toDateTimeString(),
                'period' => $period,
            ],
        ]);
    }

    /**
     * Statistiques des tickets par service.
     *
     * Query params:
     * - from/to ou period (today|week|month)
     */
    public function stats(Request $request)
    {
        $scopedId = $request->attributes->get('scoped_establishment_id');
        $user = $request->user();

        // Pour les agents, récupérer l'établissement via l'utilisateur
        if ($user->role === 'agent' && !$scopedId) {
            $scopedId = $user->establishment_id;
        }

        // Déterminer la période
        $period = $request->query('period', 'today');
        $from = $request->query('from');
        $to = $request->query('to');

        if (!$from || !$to) {
            switch ($period) {
                case 'week':
                    $from = now()->startOfWeek()->toDateString();
                    $to = now()->endOfWeek()->toDateString();
                    break;
                case 'month':
                    $from = now()->startOfMonth()->toDateString();
                    $to = now()->endOfMonth()->toDateString();
                    break;
                case 'today':
                default:
                    $from = now()->startOfDay()->toDateString();
                    $to = now()->endOfDay()->toDateString();
                    break;
            }
        }

        $from = now()->parse($from)->startOfDay();
        $to = now()->parse($to)->endOfDay();

        // Récupérer les services assignés pour l'agent
        $assignedServiceIds = null;
        if ($user->role === 'agent') {
            $assignedServiceIds = DB::table('agent_service')
                ->where('user_id', $user->id)
                ->pluck('service_id');
        }

        // Base query
        $baseQuery = function () use ($scopedId, $user, $from, $to, $assignedServiceIds) {
            $query = DB::table('tickets')
                ->join('services', 'services.id', '=', 'tickets.service_id')
                ->whereBetween('tickets.created_at', [$from, $to]);

            if ($user->role === 'admin' && !empty($scopedId)) {
                $query->where('services.establishment_id', (int) $scopedId);
            } elseif ($user->role === 'agent' && $assignedServiceIds) {
                $query->whereIn('tickets.service_id', $assignedServiceIds);
            }

            return $query;
        };

        // Si agent sans services assignés, retourner des stats vides
        if ($user->role === 'agent' && $assignedServiceIds && $assignedServiceIds->isEmpty()) {
            return response()->json([
                'period' => [
                    'from' => $from->toDateTimeString(),
                    'to' => $to->toDateTimeString(),
                    'type' => $period,
                ],
                'global' => [
                    'total' => 0,
                    'waiting' => 0,
                    'called' => 0,
                    'en_route' => 0,
                    'present' => 0,
                    'closed' => 0,
                    'absent' => 0,
                    'cancelled' => 0,
                    'expired' => 0,
                    'avg_wait_minutes' => null,
                ],
                'by_service' => [],
            ]);
        }

        // Statistiques globales
        $globalStats = $baseQuery()
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN tickets.status = 'waiting' THEN 1 ELSE 0 END) as waiting,
                SUM(CASE WHEN tickets.status = 'called' THEN 1 ELSE 0 END) as called,
                SUM(CASE WHEN tickets.status = 'closed' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN tickets.status = 'absent' THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN tickets.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                SUM(CASE WHEN tickets.status = 'expired' THEN 1 ELSE 0 END) as expired
            ")
            ->first();

        // Statistiques par service
        $serviceStats = $baseQuery()
            ->select([
                'services.id as service_id',
                'services.name as service_name',
                'services.status as service_status',
            ])
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN tickets.status = 'waiting' THEN 1 ELSE 0 END) as waiting,
                SUM(CASE WHEN tickets.status = 'called' THEN 1 ELSE 0 END) as called,
                SUM(CASE WHEN tickets.status = 'closed' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN tickets.status = 'absent' THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN tickets.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
            ")
            ->groupBy('services.id', 'services.name', 'services.status')
            ->orderByDesc('total')
            ->get();

        // Temps d'attente moyen
        $waitTimeRows = $baseQuery()
            ->whereNotNull('tickets.called_at')
            ->select(['tickets.created_at', 'tickets.called_at'])
            ->limit(1000)
            ->get();

        $totalWait = 0;
        $waitCount = 0;
        foreach ($waitTimeRows as $row) {
            $created = \Illuminate\Support\Carbon::parse($row->created_at);
            $called = \Illuminate\Support\Carbon::parse($row->called_at);
            if ($called->greaterThan($created)) {
                $totalWait += $called->diffInMinutes($created);
                $waitCount++;
            }
        }
        $avgWaitTime = $waitCount > 0 ? (int) round($totalWait / $waitCount) : null;

        return response()->json([
            'period' => [
                'from' => $from->toDateTimeString(),
                'to' => $to->toDateTimeString(),
                'type' => $period,
            ],
            'global' => [
                'total' => (int) ($globalStats->total ?? 0),
                'waiting' => (int) ($globalStats->waiting ?? 0),
                'called' => (int) ($globalStats->called ?? 0),
                'closed' => (int) ($globalStats->closed ?? 0),
                'absent' => (int) ($globalStats->absent ?? 0),
                'cancelled' => (int) ($globalStats->cancelled ?? 0),
                'expired' => (int) ($globalStats->expired ?? 0),
                'avg_wait_minutes' => $avgWaitTime,
            ],
            'by_service' => $serviceStats->map(function ($s) {
                return [
                    'service_id' => $s->service_id,
                    'service_name' => $s->service_name,
                    'service_status' => $s->service_status,
                    'total' => (int) $s->total,
                    'waiting' => (int) $s->waiting,
                    'called' => (int) $s->called,
                    'closed' => (int) $s->closed,
                    'absent' => (int) $s->absent,
                    'cancelled' => (int) $s->cancelled,
                ];
            }),
        ]);
    }

    /**
     * Détails d'un ticket spécifique.
     */
    public function show(Request $request, int $ticketId)
    {
        $scopedId = $request->attributes->get('scoped_establishment_id');
        $user = $request->user();

        // Pour les agents, récupérer l'établissement via l'utilisateur
        if ($user->role === 'agent' && !$scopedId) {
            $scopedId = $user->establishment_id;
        }

        $ticket = Ticket::with(['user', 'service.establishment', 'counter'])
            ->where('id', $ticketId)
            ->firstOrFail();

        // Vérifier l'accès
        if ($user->role === 'admin' && !empty($scopedId)) {
            if ($ticket->service->establishment_id != $scopedId) {
                abort(403, 'Accès non autorisé à ce ticket');
            }
        } elseif ($user->role === 'agent') {
            $assignedServiceIds = $user->services()->pluck('services.id');
            if (!$assignedServiceIds->contains($ticket->service_id)) {
                abort(403, 'Accès non autorisé à ce ticket');
            }
        }

        return response()->json([
            'id' => $ticket->id,
            'number' => $ticket->number,
            'status' => $ticket->status,
            'priority' => $ticket->priority,
            'position' => $ticket->position,
            'user' => $ticket->user ? [
                'id' => $ticket->user->id,
                'name' => $ticket->user->name,
                'phone' => $ticket->user->phone,
                'email' => $ticket->user->email,
            ] : null,
            'service' => $ticket->service ? [
                'id' => $ticket->service->id,
                'name' => $ticket->service->name,
                'status' => $ticket->service->status,
                'avg_service_time_minutes' => $ticket->service->avg_service_time_minutes,
            ] : null,
            'establishment' => $ticket->service?->establishment ? [
                'id' => $ticket->service->establishment->id,
                'name' => $ticket->service->establishment->name,
            ] : null,
            'counter' => $ticket->counter ? [
                'id' => $ticket->counter->id,
                'name' => $ticket->counter->name,
            ] : null,
            'called_at' => $ticket->called_at?->toDateTimeString(),
            'closed_at' => $ticket->closed_at?->toDateTimeString(),
            'absent_at' => $ticket->absent_at?->toDateTimeString(),
            'created_at' => $ticket->created_at->toDateTimeString(),
            'updated_at' => $ticket->updated_at->toDateTimeString(),
        ]);
    }
}
