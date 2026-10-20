<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreTicketRequest;
use App\Models\Ticket;
use App\Models\Service;
use App\Services\TicketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Events\ServiceTicketEnqueued;
use App\Events\UserTicketUpdated;
use App\Events\TicketUpdated;
use Illuminate\Support\Carbon;

class TicketController extends Controller
{
    /**
     * Liste des services accessibles à l'utilisateur courant (agent = services assignés, admin = tous).
     */
    public function services(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'agent') {
            $services = $user->services()
                ->select('services.id', 'services.name', 'services.status')
                ->orderBy('services.name')
                ->get();
        } else {
            $scopedId = $request->attributes->get('scoped_establishment_id') ?: $user->establishment_id;
            if (empty($scopedId)) {
                abort(403, 'Admin has no establishment scope');
            }
            $services = Service::query()
                ->when($scopedId, fn($q) => $q->where('establishment_id', (int) $scopedId))
                ->select('id', 'name', 'status')
                ->orderBy('name')
                ->get();
        }

        return response()->json([
            'data' => $services->map(fn($s) => [
                'id'     => $s->id,
                'name'   => $s->name,
                'status' => $s->status,
            ]),
        ]);
    }

    /**
     * Création manuelle d'un ticket par un agent/admin.
     * Aucun compte utilisateur requis (user_id = null).
     */
    public function store(StoreTicketRequest $request, TicketService $ticketService)
    {
        $agent = $request->user();
        $serviceId = (int) $request->validated('service_id');

        // Vérifier l'accès au service (agent assigné ou admin de l'établissement)
        if (!$agent->can('manage', Service::findOrFail($serviceId))) {
            abort(403, 'Accès non autorisé à ce service');
        }

        $priority = $request->validated('priority') ?? 'normal';

        $ticket = DB::transaction(function () use ($serviceId, $priority, $request, $ticketService) {
            $service = Service::lockForUpdate()->findOrFail($serviceId);
            $targetDate = Carbon::today()->toDateString();

            // Générer un numéro de ticket (même règle que les tickets de l'app)
            $number = $ticketService->nextTicketNumber($service, $targetDate);

            // Position dans la file (VIP/high s'insèrent devant les tickets normal)
            // La vraie position sera recalculée par recomputePositions ci-dessous
            $position = Ticket::query()
                ->where('service_id', $serviceId)
                ->where('status', 'waiting')
                ->whereDate('valid_date', $targetDate)
                ->count() + 1;

            $ticket = Ticket::create([
                'user_id'        => null,
                'service_id'     => $serviceId,
                'number'         => $number,
                'status'         => 'waiting',
                'priority'       => $priority,
                'position'       => $position,
                'source'         => 'agent',
                'valid_date'     => $targetDate,
                'customer_name'   => $request->validated('customer_name'),
                'customer_phone'  => $request->validated('customer_phone'),
                'is_senior'       => $request->boolean('is_senior', false),
                'is_handicap'     => $request->boolean('is_handicap', false),
                'is_pregnant'     => $request->boolean('is_pregnant', false),
                'priority_reason' => $request->validated('priority_reason'),
            ]);

            // Recalcule les positions avec le tri priorité
            $ticketService->recomputePositions($service);

            // Recharger après recompute
            $ticket->refresh();

            try {
                event(new ServiceTicketEnqueued($serviceId, [
                    'service_id'    => $serviceId,
                    'ticket_id'     => $ticket->id,
                    'ticket_number' => $ticket->number,
                    'priority'      => $ticket->priority,
                    'ticket' => [
                        'id'       => $ticket->id,
                        'number'   => $ticket->number,
                        'priority' => $ticket->priority,
                    ],
                ]));
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::warning('Broadcast ServiceTicketEnqueued failed: ' . $e->getMessage());
            }

            return $ticket;
        });

        return response()->json([
            'id'             => $ticket->id,
            'number'         => $ticket->number,
            'status'         => $ticket->status,
            'priority'       => $ticket->priority,
            'position'       => $ticket->position,
            'source'         => $ticket->source,
            'customer_name'  => $ticket->customer_name,
            'customer_phone' => $ticket->customer_phone,
            'is_senior'      => (bool) $ticket->is_senior,
            'is_handicap'    => (bool) $ticket->is_handicap,
            'is_pregnant'    => (bool) $ticket->is_pregnant,
            'service' => [
                'id'   => $ticket->service_id,
                'name' => Service::find($ticket->service_id)?->name,
            ],
            'created_at' => $ticket->created_at->toDateTimeString(),
        ], 201);
    }

    /**
     * Requête filtrée commune à la liste et à l'export (scope, période, service, statut).
     *
     * @return array{0: \Illuminate\Database\Eloquent\Builder, 1: \Illuminate\Support\Carbon, 2: \Illuminate\Support\Carbon, 3: string}
     */
    private function filteredTicketsQuery(Request $request): array
    {
        $scopedId = $request->attributes->get('scoped_establishment_id');
        $user = $request->user();

        // Via les routes /agent/*, le middleware de scope n'est pas appliqué :
        // l'établissement est celui de l'utilisateur (agent comme admin).
        if (!$scopedId) {
            $scopedId = $user->establishment_id;
        }
        if ($user->role === 'admin' && empty($scopedId)) {
            abort(403, 'Admin has no establishment scope');
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

        // Pour les tickets reportés, utiliser created_at élargi ou valid_date future
        if ($request->boolean('auto_deferred')) {
            $from = now()->parse(now()->subDays(60)->toDateString())->startOfDay();
            $to = now()->parse(now()->addDays(30)->toDateString())->endOfDay();
        }

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
            // Sans service assigné, aucun ticket (whereIn sur une liste vide)
            $query->whereIn('tickets.service_id', $assignedServiceIds->all() ?: [0]);
        }

        // Filtre par service
        if ($request->filled('service_id')) {
            $query->where('tickets.service_id', (int) $request->query('service_id'));
        }

        // Filtre par statut
        $status = $request->query('status');
        if ($status && $status !== 'all') {
            if ($status === 'active') {
                $query->whereIn('tickets.status', ['waiting', 'called', 'en_route', 'present', 'absent']);
            } elseif ($status === 'completed') {
                $query->whereIn('tickets.status', ['closed', 'canceled', 'cancelled', 'expired']);
            } elseif (in_array($status, ['canceled', 'cancelled'], true)) {
                // Le statut stocké est 'canceled' ; 'cancelled' est accepté pour les clients existants
                $query->whereIn('tickets.status', ['canceled', 'cancelled']);
            } else {
                $query->where('tickets.status', $status);
            }
        }

        // Filtre tickets reportés
        if ($request->boolean('auto_deferred')) {
            $query->where('tickets.auto_deferred', true)
                  ->where('tickets.status', 'waiting')
                  ->whereDate('tickets.valid_date', '>', now()->toDateString());
        }

        return [$query, $from, $to, $period];
    }

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
        [$query, $from, $to, $period] = $this->filteredTicketsQuery($request);
        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);
        $withDetails = $request->boolean('with_details', false);

        // Sélection et tri
        $query->select([
            'tickets.id',
            'tickets.number',
            'tickets.status',
            'tickets.priority',
            'tickets.source',
            'tickets.position',
            'tickets.service_id',
            'tickets.counter_id',
            'tickets.called_at',
            'tickets.closed_at',
            'tickets.absent_at',
            'tickets.created_at',
            'tickets.updated_at',
            'tickets.customer_name',
            'tickets.customer_phone',
            'tickets.is_senior',
            'tickets.is_handicap',
            'tickets.is_pregnant',
            'tickets.auto_deferred',
            'tickets.defer_reason',
            'tickets.valid_date',
            'services.name as service_name',
            'services.status as service_status',
        ]);

        $query->orderByDesc('tickets.created_at');

        // Pagination
        $paginator = $query->paginate($perPage);

        // Transformer les résultats
        $tickets = collect($paginator->items())->map(function ($ticket) use ($withDetails) {
            $data = [
                'id'             => $ticket->id,
                'number'         => $ticket->number,
                'status'         => $ticket->status,
                'priority'       => $ticket->priority,
                'source'         => $ticket->source,
                'position'       => $ticket->position,
                'customer_name'  => $ticket->customer_name,
                'customer_phone' => $ticket->customer_phone,
                'is_senior'      => (bool) $ticket->is_senior,
                'is_handicap'    => (bool) $ticket->is_handicap,
                'is_pregnant'    => (bool) $ticket->is_pregnant,
                'auto_deferred'  => (bool) $ticket->auto_deferred,
                'defer_reason'   => $ticket->defer_reason,
                'valid_date'     => $ticket->valid_date,
                'service' => [
                    'id'     => $ticket->service_id,
                    'name'   => $ticket->service_name,
                    'status' => $ticket->service_status,
                ],
                'counter_id' => $ticket->counter_id,
                'called_at'  => $ticket->called_at?->toDateTimeString(),
                'closed_at'  => $ticket->closed_at?->toDateTimeString(),
                'absent_at'  => $ticket->absent_at?->toDateTimeString(),
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
     * Export CSV des tickets (mêmes filtres que la liste). BOM UTF-8 pour Excel.
     */
    public function export(Request $request)
    {
        [$query, $from, $to] = $this->filteredTicketsQuery($request);

        $query->select([
            'tickets.id', 'tickets.number', 'tickets.status', 'tickets.priority', 'tickets.source',
            'tickets.position', 'tickets.customer_name', 'tickets.customer_phone',
            'tickets.valid_date', 'tickets.created_at', 'tickets.called_at', 'tickets.closed_at',
            'tickets.absent_at', 'services.name as service_name',
        ])->orderBy('tickets.id');

        $filename = 'tickets_'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv';

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['id', 'numero', 'service', 'statut', 'priorite', 'source', 'position',
                'client', 'telephone', 'date_validite', 'cree_le', 'appele_le', 'cloture_le', 'absent_le']);

            $query->chunk(1000, function ($rows) use ($out) {
                foreach ($rows as $t) {
                    fputcsv($out, [
                        $t->id, $t->number, $t->service_name, $t->status, $t->priority, $t->source,
                        $t->position, $t->customer_name, $t->customer_phone,
                        $t->valid_date?->toDateString(), $t->created_at?->toDateTimeString(),
                        $t->called_at?->toDateTimeString(), $t->closed_at?->toDateTimeString(),
                        $t->absent_at?->toDateTimeString(),
                    ]);
                }
            });

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
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

        // Via les routes /agent/*, le middleware de scope n'est pas appliqué :
        // l'établissement est celui de l'utilisateur (agent comme admin).
        if (!$scopedId) {
            $scopedId = $user->establishment_id;
        }
        if ($user->role === 'admin' && empty($scopedId)) {
            abort(403, 'Admin has no establishment scope');
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
                SUM(CASE WHEN tickets.status = 'en_route' THEN 1 ELSE 0 END) as en_route,
                SUM(CASE WHEN tickets.status = 'present' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN tickets.status = 'closed' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN tickets.status = 'absent' THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN tickets.status IN ('canceled', 'cancelled') THEN 1 ELSE 0 END) as cancelled,
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
                SUM(CASE WHEN tickets.status IN ('canceled', 'cancelled') THEN 1 ELSE 0 END) as cancelled
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
                $totalWait += $created->diffInMinutes($called); // Carbon 3 : signé
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
                'en_route' => (int) ($globalStats->en_route ?? 0),
                'present' => (int) ($globalStats->present ?? 0),
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

        // Via les routes /agent/*, le middleware de scope n'est pas appliqué :
        // l'établissement est celui de l'utilisateur (agent comme admin).
        if (!$scopedId) {
            $scopedId = $user->establishment_id;
        }
        if ($user->role === 'admin' && empty($scopedId)) {
            abort(403, 'Admin has no establishment scope');
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
            'id'             => $ticket->id,
            'number'         => $ticket->number,
            'status'         => $ticket->status,
            'priority'       => $ticket->priority,
            'source'         => $ticket->source,
            'position'       => $ticket->position,
            'customer_name'  => $ticket->customer_name,
            'customer_phone' => $ticket->customer_phone,
            'is_senior'      => (bool) $ticket->is_senior,
            'is_handicap'    => (bool) $ticket->is_handicap,
            'is_pregnant'    => (bool) $ticket->is_pregnant,
            'user' => $ticket->user ? [
                'id'    => $ticket->user->id,
                'name'  => $ticket->user->name,
                'phone' => $ticket->user->phone,
                'email' => $ticket->user->email,
            ] : null,
            'service' => $ticket->service ? [
                'id'                       => $ticket->service->id,
                'name'                     => $ticket->service->name,
                'status'                   => $ticket->service->status,
                'avg_service_time_minutes' => $ticket->service->avg_service_time_minutes,
            ] : null,
            'establishment' => $ticket->service?->establishment ? [
                'id'   => $ticket->service->establishment->id,
                'name' => $ticket->service->establishment->name,
            ] : null,
            'counter' => $ticket->counter ? [
                'id'   => $ticket->counter->id,
                'name' => $ticket->counter->name,
            ] : null,
            'called_at'  => $ticket->called_at?->toDateTimeString(),
            'closed_at'  => $ticket->closed_at?->toDateTimeString(),
            'absent_at'  => $ticket->absent_at?->toDateTimeString(),
            'created_at' => $ticket->created_at->toDateTimeString(),
            'updated_at' => $ticket->updated_at->toDateTimeString(),
        ]);
    }
}
