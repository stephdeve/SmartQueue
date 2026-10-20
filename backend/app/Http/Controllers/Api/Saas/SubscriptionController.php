<?php

namespace App\Http\Controllers\Api\Saas;

use App\Http\Controllers\Controller;
use App\Models\Establishment;
use App\Models\Subscription;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);

        $query = Subscription::query()->with('establishment')->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('plan')) {
            $query->where('plan', $request->query('plan'));
        }
        if ($request->filled('establishment_id')) {
            $query->where('establishment_id', (int) $request->query('establishment_id'));
        }

        return response()->json($query->paginate($perPage));
    }

    public function upsert(Request $request, Establishment $establishment)
    {
        $data = $request->validate([
            'plan' => ['required','string','max:32'],
            'status' => ['required','in:trial,active,past_due,canceled'],
            'current_period_start' => ['nullable','date'],
            'current_period_end' => ['nullable','date'],
            'canceled_at' => ['nullable','date'],
            'meta' => ['nullable','array'],
        ]);

        $sub = Subscription::query()->firstOrNew([
            'establishment_id' => $establishment->id,
        ]);

        $sub->fill($data);
        $sub->establishment_id = $establishment->id;
        $sub->save();

        return response()->json($sub->fresh());
    }
}
