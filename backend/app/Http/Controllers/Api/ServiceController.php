<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Service;
use App\Http\Resources\ServiceResource;
use Illuminate\Support\Facades\DB;

class ServiceController extends Controller
{
    /**
     * Liste des services d'un établissement.
     */
    public function byEstablishment(int $id)
    {
        $q = request();
        $perPage = min(max((int) $q->query('per_page', 20), 1), 100);
        $status = $q->query('status'); // open|closed
        $prio = $q->boolean('priority_support'); // true/false
        $min = $q->query('people_waiting_min');
        $max = $q->query('people_waiting_max');

        $builder = Service::query()
            ->where('establishment_id', $id)
            ->withCount(['tickets as people_waiting' => function ($q2) {
                $q2->where('status', 'waiting');
            }])
            ->orderBy('name');

        if (in_array($status, ['open','closed'], true)) {
            $builder->where('status', $status);
        }
        if ($q->has('priority_support')) {
            $builder->where('priority_support', (bool) $prio);
        }
        if (is_numeric($min)) {
            $builder->having('people_waiting', '>=', (int) $min);
        }
        if (is_numeric($max)) {
            $builder->having('people_waiting', '<=', (int) $max);
        }

        $paginator = $builder->paginate($perPage);
        return ServiceResource::collection($paginator);
    }

    /**
     * Détail d'un service.
     */
    public function show(int $id)
    {
        $service = Service::query()
            ->with('establishment')
            ->withCount(['tickets as people_waiting' => function ($q) {
                $q->where('status', 'waiting');
            }])
            ->findOrFail($id);

        return new ServiceResource($service);
    }

    /**
     * Affluence du service (niveau, personnes, ETA moyen).
     */
    public function affluence(int $id)
    {
        $service = Service::findOrFail($id);

        $people = DB::table('tickets')
            ->where('service_id', $id)
            ->where('status', 'waiting')
            ->count();

        // ETA moyen basé sur les 24h: moyenne(closed_at - called_at) calculée en PHP pour compat SQL
        $rows = DB::table('tickets')
            ->where('service_id', $id)
            ->whereNotNull('closed_at')
            ->whereNotNull('called_at')
            ->where('closed_at', '>=', now()->subDay())
            ->select(['called_at','closed_at'])
            ->limit(500)
            ->get();
        $sum = 0; $n = 0;
        foreach ($rows as $r) {
            $called = \Illuminate\Support\Carbon::parse($r->called_at);
            $closed = \Illuminate\Support\Carbon::parse($r->closed_at);
            if ($closed->greaterThan($called)) {
                $sum += $closed->diffInMinutes($called);
                $n++;
            }
        }
        $etaAvg = $n > 0 ? (int) round($sum / $n) : (int) $service->avg_service_time_minutes;

        $level = 'low';
        if ($people >= 10) { $level = 'high'; }
        elseif ($people >= 5) { $level = 'medium'; }

        return response()->json([
            'level' => $level,
            'people' => $people,
            'eta_avg' => $etaAvg,
        ]);
    }

    /**
     * Recommandations horaires (placeholder basé sur heuristiques simples).
     */
    public function recommendations(int $id)
    {
        // TODO: Remplacer par analyse historique réelle (analytics_events)
        return response()->json([
            ['start' => '08:00', 'end' => '09:00', 'reason' => 'Faible affluence historique'],
            ['start' => '14:00', 'end' => '15:00', 'reason' => 'Temps d’attente moyen bas'],
        ]);
    }
}
