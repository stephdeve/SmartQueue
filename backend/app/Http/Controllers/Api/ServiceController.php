<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Service;
use App\Http\Resources\ServiceResource;
use App\Services\ServiceAvailabilityService;
use App\Services\SmartQueueEngine;
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
            ->withCount(['agents as agents_count'])
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
        // Reco basée sur l'historique des 30 derniers jours: volume d'appels/clôtures par heure
        $service = Service::findOrFail($id);

        $start = now()->subDays(30);
        $rows = DB::table('tickets')
            ->where('service_id', $id)
            ->where(function ($q) use ($start) {
                $q->where('called_at', '>=', $start)
                  ->orWhere('closed_at', '>=', $start);
            })
            ->select(['called_at', 'closed_at'])
            ->limit(5000)
            ->get();

        $counts = array_fill(0, 24, 0);
        foreach ($rows as $r) {
            $t = $r->called_at ?: $r->closed_at;
            if (!$t) {
                continue;
            }
            $h = (int) \Illuminate\Support\Carbon::parse($t)->format('G');
            if ($h >= 0 && $h <= 23) {
                $counts[$h]++;
            }
        }

        // S'il n'y a pas assez de données, fallback sur des créneaux neutres
        $total = array_sum($counts);
        if ($total < 30) {
            return response()->json([
                ['start' => '09:00', 'end' => '10:00', 'reason' => 'Données insuffisantes (fallback)'],
                ['start' => '14:00', 'end' => '15:00', 'reason' => 'Données insuffisantes (fallback)'],
            ]);
        }

        // Score par fenêtre glissante de 60 minutes: moins de volume = mieux
        $window = 1; // heures
        $scores = [];
        for ($h = 0; $h < 24; $h++) {
            $sum = 0;
            for ($k = 0; $k < $window; $k++) {
                $sum += $counts[($h + $k) % 24];
            }
            $scores[] = ['h' => $h, 'sum' => $sum];
        }
        usort($scores, fn ($a, $b) => $a['sum'] <=> $b['sum']);

        $picked = [];
        $usedHours = [];
        foreach ($scores as $s) {
            $h = $s['h'];
            // éviter créneaux trop proches (±1h)
            if (isset($usedHours[$h]) || isset($usedHours[($h + 23) % 24]) || isset($usedHours[($h + 1) % 24])) {
                continue;
            }
            $usedHours[$h] = true;

            $startStr = str_pad((string) $h, 2, '0', STR_PAD_LEFT).':00';
            $endH = ($h + 1) % 24;
            $endStr = str_pad((string) $endH, 2, '0', STR_PAD_LEFT).':00';

            $picked[] = [
                'start' => $startStr,
                'end' => $endStr,
                'reason' => 'Faible affluence historique (30j) – '.$s['sum'].' passages',
            ];
            if (count($picked) >= 3) {
                break;
            }
        }

        // Ajoute un hint ETA moyen (facultatif) pour le front
        return response()->json([
            'service_id' => $service->id,
            'avg_service_time_minutes' => (int) $service->avg_service_time_minutes,
            'windows' => $picked,
        ]);
    }

    /**
     * Disponibilité publique du service (basée sur la configuration backend).
     * Source unique de vérité — utilisée par le mobile/web pour informer l'usager.
     */
    public function availability(int $id, ServiceAvailabilityService $availability, SmartQueueEngine $smartQueue)
    {
        $service = Service::with(['workingDays','exceptions'])->findOrFail($id);
        return response()->json([
            'service_id' => $service->id,
            'status' => $service->status,
            'avg_service_time_minutes' => (int) $service->avg_service_time_minutes,
            'availability' => $availability->snapshot($service),
            'capacity' => $smartQueue->loadSnapshot($service),
        ]);
    }
}
