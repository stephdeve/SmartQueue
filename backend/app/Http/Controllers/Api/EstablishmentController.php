<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Establishment;
use App\Http\Resources\EstablishmentResource;
use Illuminate\Support\Facades\DB;

class EstablishmentController extends Controller
{
    /**
     * Liste des établissements.
     * Si lat/lng fournis, ajoute une estimation de distance et trie par distance.
     */
    public function index(Request $request)
    {
        $lat = $request->query('lat');
        $lng = $request->query('lng');
        $radius = (int) ($request->query('radius', 5000)); // mètres

        $query = Establishment::query()->where('is_active', true);

        if ($lat !== null && $lng !== null) {
            // Formule Haversine approchée (compatible SQLite/MySQL/Postgres)
            $haversine = "(6371000 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(? - lat)/2),2) + COS(RADIANS(lat)) * COS(RADIANS(?)) * POWER(SIN(RADIANS(? - lng)/2),2))))";
            $query->select('*')
                ->selectRaw($haversine.' as distance_m', [$lat, $lat, $lng])
                ->orderBy('distance_m');
            // Optionnel: filtrer par rayon (approx)
            // $query->having('distance_m', '<=', $radius);
        } else {
            $query->orderBy('name');
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
                $builder->where('name', 'like', '%'.$q.'%')
                        ->orWhere('address', 'like', '%'.$q.'%');
            })
            ->orderBy('name')
            ;
        $paginator = $builder->paginate($perPage);
        return EstablishmentResource::collection($paginator);
    }

    /** Détail d'un établissement. */
    public function show(int $id)
    {
        $est = Establishment::findOrFail($id);
        return new EstablishmentResource($est);
    }
}
