<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Establishment;
use App\Http\Resources\EstablishmentResource;

class EstablishmentController extends Controller
{
    /** Liste des établissements (admin). */
    public function index()
    {
        $items = Establishment::query()->orderByDesc('created_at')->paginate(50);
        return EstablishmentResource::collection($items);
    }

    /** Création d'un établissement. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required','string','max:160'],
            'address' => ['nullable','string'],
            'lat' => ['nullable','numeric','between:-90,90'],
            'lng' => ['nullable','numeric','between:-180,180'],
            'open_at' => ['nullable'],
            'close_at' => ['nullable'],
            'is_active' => ['boolean'],
        ]);
        $est = Establishment::create($data);
        return new EstablishmentResource($est);
    }

    /** Détail. */
    public function show(int $id)
    {
        $est = Establishment::findOrFail($id);
        return new EstablishmentResource($est);
    }

    /** Mise à jour. */
    public function update(Request $request, int $id)
    {
        $est = Establishment::findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes','string','max:160'],
            'address' => ['sometimes','nullable','string'],
            'lat' => ['sometimes','nullable','numeric','between:-90,90'],
            'lng' => ['sometimes','nullable','numeric','between:-180,180'],
            'open_at' => ['sometimes','nullable'],
            'close_at' => ['sometimes','nullable'],
            'is_active' => ['sometimes','boolean'],
        ]);
        $est->update($data);
        return new EstablishmentResource($est);
    }

    /** Suppression. */
    public function destroy(int $id)
    {
        $est = Establishment::findOrFail($id);
        $est->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
