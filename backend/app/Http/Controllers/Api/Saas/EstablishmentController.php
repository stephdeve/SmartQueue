<?php

namespace App\Http\Controllers\Api\Saas;

use App\Http\Controllers\Controller;
use App\Models\Establishment;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;

class EstablishmentController extends Controller
{
    /**
     * Établissements clients avec leur abonnement, leur administrateur et leur activité.
     */
    public function index(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);

        $items = Establishment::query()
            ->with([
                'subscription',
                'staff' => fn ($q) => $q->where('role', 'admin')->select(['id', 'name', 'email', 'phone', 'establishment_id']),
            ])
            ->withCount([
                'tickets as total_tickets',
                'staff as total_agents' => fn ($q) => $q->where('role', 'agent'),
                'services as total_services',
            ])
            ->withMax('tickets as last_active', 'tickets.created_at')
            ->orderByDesc('created_at')
            ->paginate($perPage);

        $items->getCollection()->transform(function (Establishment $est) {
            $row = $est->toArray();
            $row['admins'] = $est->staff->values();
            $row['subscription'] = SubscriptionService::present($est->subscription);
            unset($row['staff']);

            return $row;
        });

        return response()->json($items);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required','string','max:160'],
            'address' => ['nullable','string'],
            'lat' => ['nullable','numeric','between:-90,90'],
            'lng' => ['nullable','numeric','between:-180,180'],
            'open_at' => ['nullable','date_format:H:i,H:i:s'],
            'close_at' => ['nullable','date_format:H:i,H:i:s'],
            'is_active' => ['boolean'],
        ]);

        $est = Establishment::create($data);

        return response()->json($est->load('subscription'));
    }

    public function show(int $id)
    {
        $est = Establishment::with('subscription')->findOrFail($id);
        return response()->json($est);
    }

    public function update(Request $request, int $id)
    {
        $est = Establishment::findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes','string','max:160'],
            'address' => ['sometimes','nullable','string'],
            'lat' => ['sometimes','nullable','numeric','between:-90,90'],
            'lng' => ['sometimes','nullable','numeric','between:-180,180'],
            'open_at' => ['sometimes','nullable','date_format:H:i,H:i:s'],
            'close_at' => ['sometimes','nullable','date_format:H:i,H:i:s'],
            'is_active' => ['sometimes','boolean'],
        ]);
        $est->update($data);
        return response()->json($est->load('subscription'));
    }

    public function destroy(int $id)
    {
        $est = Establishment::findOrFail($id);
        $est->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
