<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Establishment;
use App\Http\Resources\EstablishmentResource;
use App\Services\ServiceAvailabilityService;
use Illuminate\Support\Facades\DB;

class EstablishmentController extends Controller
{
    public function __construct(private readonly ServiceAvailabilityService $availability) {}

    /**
     * Liste des établissements.
     * Si lat/lng fournis, ajoute une estimation de distance et trie par distance.
     */
    public function index(Request $request)
    {
        $lat = $request->query('lat');
        $lng = $request->query('lng');
        $radius = (int) ($request->query('radius', 5000)); // mètres
        $category = $request->query('category');
        $allowedCategories = ['banking', 'health', 'public', 'social'];
        if ($category !== null && $category !== '' && !in_array($category, $allowedCategories, true)) {
            $category = null;
        }

        // Route publique : l'utilisateur n'est résolu que si un token Sanctum est envoyé
        $user = $request->user('sanctum');
        $today = now()->toDateString();

        $query = Establishment::query()
            ->where('establishments.is_active', true)
            ->when($category !== null && $category !== '', function ($q) use ($category) {
                $q->where('establishments.category', $category);
            })
            ->leftJoin('services', 'services.establishment_id', '=', 'establishments.id')
            ->leftJoin('tickets', function ($join) use ($today) {
                // File du jour uniquement (les tickets reportés à une date future
                // ne sont pas devant l'usager aujourd'hui)
                $join->on('tickets.service_id', '=', 'services.id')
                    ->where('tickets.status', '=', 'waiting')
                    ->whereDate('tickets.valid_date', '=', $today);
            })
            ->select('establishments.*')
            ->selectRaw('COUNT(DISTINCT services.id) as services_count')
            ->selectRaw('COUNT(tickets.id) as people_waiting')
            ->selectRaw("CASE WHEN COUNT(tickets.id) >= 16 THEN 'high' WHEN COUNT(tickets.id) >= 6 THEN 'medium' ELSE 'low' END as crowd_level")
            ->groupBy('establishments.id');

        if ($user) {
            $query->withExists(['favoritedBy as is_favorited' => fn ($q) => $q->where('user_id', $user->id)]);
        }

        if ($lat !== null && $lng !== null) {
            $lat = (float) $lat;
            $lng = (float) $lng;
            $radius = max(100, min($radius, 200_000));

            // On ne peut pas calculer une distance sans coordonnées.
            $query->whereNotNull('establishments.lat')->whereNotNull('establishments.lng');

            // Formule Haversine approchée (compatible MySQL/Postgres).
            // Colonnes qualifiées et select existant conservé : un `select *` sur la
            // jointure services/tickets avec GROUP BY établissement est refusé par
            // PostgreSQL (et écrasait l'id de l'établissement par celui du ticket).
            $haversine = "(6371000 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(? - establishments.lat)/2),2) + COS(RADIANS(establishments.lat)) * COS(RADIANS(?)) * POWER(SIN(RADIANS(? - establishments.lng)/2),2))))";
            $query->selectRaw($haversine.' as distance_m', [$lat, $lat, $lng])
                ->orderBy('distance_m');
            // PostgreSQL ne permet pas d'utiliser un alias dans HAVING
            // On utilise havingRaw avec l'expression complète
            $query->havingRaw($haversine.' <= ?', [$lat, $lat, $lng, $radius]);
        } else {
            $query->orderBy('establishments.name');
        }

        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);
        $paginator = $query->paginate($perPage);
        return EstablishmentResource::collection($paginator);
    }

    /** Recherche par nom/adresse. */
    public function search(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);
        $builder = Establishment::query()
            ->where('is_active', true)
            ->where(function ($builder) use ($q) {
                // LIKE est sensible à la casse sous PostgreSQL
                $needle = '%'.mb_strtolower($q).'%';
                $builder->whereRaw('LOWER(name) LIKE ?', [$needle])
                        ->orWhereRaw('LOWER(address) LIKE ?', [$needle]);
            })
            ->orderBy('name')
            ;
        $paginator = $builder->paginate($perPage);
        return EstablishmentResource::collection($paginator);
    }

    /** Détail d'un établissement. */
    public function show(Request $request, int $id)
    {
        $user = $request->user('sanctum');

        $est = Establishment::query()
            ->where('id', $id)
            ->when($user, fn ($q) => $q->withExists(['favoritedBy as is_favorited' => fn ($q2) => $q2->where('user_id', $user->id)]))
            ->with(['services' => function ($q) {
                $q->with('workingDays')
                  ->withCount(['tickets as people_waiting' => function ($q2) {
                      $q2->where('status', 'waiting')->whereDate('valid_date', now()->toDateString());
                  }]);
            }])
            ->findOrFail($id);

        // Initialise les working_days pour tout service qui n'en aurait pas encore
        foreach ($est->services as $service) {
            if ($service->workingDays->isEmpty()) {
                $this->availability->ensureWorkingDaysExist($service);
                // Recharger la relation directement sur l'objet (pas de new instance)
                $service->load('workingDays');
            }
        }

        // Calculate total people waiting across all services
        $totalPeopleWaiting = $est->services->sum('people_waiting');

        $resource = new EstablishmentResource($est);
        $data = $resource->resolve(request());
        $data['total_people_waiting'] = $totalPeopleWaiting;
        $data['services'] = $est->services->map(function ($service) {
            return [
                'id' => $service->id,
                'name' => $service->name,
                'status' => $service->status,
                'description' => $service->description,
                'opening_time' => $service->opening_time,
                'closing_time' => $service->closing_time,
                'avg_service_time_minutes' => (int) $service->avg_service_time_minutes,
                'people_waiting' => (int) ($service->people_waiting ?? 0),
                'working_days' => $service->workingDays->map(fn($wd) => [
                    'day_of_week'  => $wd->day_of_week,
                    'is_open'      => $wd->is_open,
                    'opening_time' => $wd->opening_time,
                    'closing_time' => $wd->closing_time,
                ])->values(),
            ];
        });
        
        return response()->json($data);
    }
}
