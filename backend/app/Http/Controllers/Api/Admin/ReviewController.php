<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReviewController extends Controller
{
    /**
     * Statistiques des évaluations pour l'établissement de l'admin.
     * GET /api/admin/reviews/stats
     */
    public function stats(Request $request)
    {
        $scopedId = $request->attributes->get('scoped_establishment_id');

        $serviceIds = Service::where('establishment_id', (int) $scopedId)->pluck('id');

        if ($serviceIds->isEmpty()) {
            return response()->json([
                'services'     => [],
                'distribution' => [],
                'evolution'    => [],
                'global_avg'   => null,
                'total'        => 0,
            ]);
        }

        // Statistiques par service
        $services = DB::table('reviews')
            ->whereIn('reviews.service_id', $serviceIds)
            ->join('services', 'reviews.service_id', '=', 'services.id')
            ->selectRaw('reviews.service_id, services.name as service_name, AVG(reviews.rating) as avg_rating, COUNT(reviews.id) as total')
            ->groupBy('reviews.service_id', 'services.name')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => [
                'service_id'   => $r->service_id,
                'service_name' => $r->service_name,
                'avg_rating'   => round((float) $r->avg_rating, 2),
                'total'        => (int) $r->total,
            ]);

        // Distribution globale (1–5)
        $rawDist = DB::table('reviews')
            ->whereIn('service_id', $serviceIds)
            ->selectRaw('rating, COUNT(*) as count')
            ->groupBy('rating')
            ->orderBy('rating')
            ->pluck('count', 'rating');

        $distribution = [];
        for ($i = 1; $i <= 5; $i++) {
            $distribution[] = ['rating' => $i, 'count' => (int) ($rawDist[$i] ?? 0)];
        }

        // Évolution sur 30 jours
        $evolution = DB::table('reviews')
            ->whereIn('service_id', $serviceIds)
            ->where('reviews.created_at', '>=', Carbon::now()->subDays(30))
            ->selectRaw("DATE(reviews.created_at) as date, AVG(reviews.rating) as avg_rating, COUNT(reviews.id) as count")
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($r) => [
                'date'       => $r->date,
                'avg_rating' => round((float) $r->avg_rating, 2),
                'count'      => (int) $r->count,
            ]);

        // Total + moyenne globale
        $totals = DB::table('reviews')
            ->whereIn('service_id', $serviceIds)
            ->selectRaw('COUNT(*) as total, AVG(rating) as global_avg')
            ->first();

        return response()->json([
            'services'     => $services,
            'distribution' => $distribution,
            'evolution'    => $evolution,
            'global_avg'   => $totals->global_avg !== null ? round((float) $totals->global_avg, 2) : null,
            'total'        => (int) ($totals->total ?? 0),
        ]);
    }
}
