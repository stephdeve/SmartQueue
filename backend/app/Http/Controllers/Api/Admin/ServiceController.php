<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Service;
use App\Http\Resources\ServiceResource;

class ServiceController extends Controller
{
    /** Liste des services. */
    public function index()
    {
        $items = Service::query()->with('establishment')->orderByDesc('created_at')->paginate(50);
        return ServiceResource::collection($items);
    }

    /** Création d'un service. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'establishment_id' => ['required','integer','exists:establishments,id'],
            'name' => ['required','string','max:160'],
            'avg_service_time_minutes' => ['nullable','integer','min:1','max:240'],
            'status' => ['nullable','in:open,closed'],
            'priority_support' => ['nullable','boolean'],
        ]);
        $service = Service::create($data);
        return new ServiceResource($service->load('establishment'));
    }

    /** Détail d'un service. */
    public function show(int $id)
    {
        $service = Service::with('establishment')->findOrFail($id);
        return new ServiceResource($service);
    }

    /** Mise à jour d'un service. */
    public function update(Request $request, int $id)
    {
        $service = Service::findOrFail($id);
        $data = $request->validate([
            'establishment_id' => ['sometimes','integer','exists:establishments,id'],
            'name' => ['sometimes','string','max:160'],
            'avg_service_time_minutes' => ['sometimes','integer','min:1','max:240'],
            'status' => ['sometimes','in:open,closed'],
            'priority_support' => ['sometimes','boolean'],
        ]);
        $service->update($data);
        return new ServiceResource($service->load('establishment'));
    }

    /** Suppression. */
    public function destroy(int $id)
    {
        $service = Service::findOrFail($id);
        $service->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
