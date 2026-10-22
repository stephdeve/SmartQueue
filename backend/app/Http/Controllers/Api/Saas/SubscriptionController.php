<?php

namespace App\Http\Controllers\Api\Saas;

use App\Http\Controllers\Controller;
use App\Models\Establishment;
use App\Models\Subscription;
use App\Services\SubscriptionService;
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

        $page = $query->paginate($perPage);
        $page->getCollection()->transform(function (Subscription $sub) {
            return SubscriptionService::present($sub) + [
                'establishment' => $sub->establishment ? [
                    'id' => $sub->establishment->id,
                    'name' => $sub->establishment->name,
                    'is_active' => (bool) $sub->establishment->is_active,
                ] : null,
                'meta' => $sub->meta,
            ];
        });

        return response()->json($page);
    }

    public function upsert(Request $request, Establishment $establishment)
    {
        $data = $request->validate([
            'plan' => ['required', 'string', 'max:32', function ($attribute, $value, $fail) {
                if (!SubscriptionService::normalizePlan($value)) {
                    $fail('Offre inconnue.');
                }
            }],
            'status' => ['required','in:trial,active,past_due,canceled'],
            'current_period_start' => ['nullable','date'],
            'current_period_end' => ['nullable','date'],
            'canceled_at' => ['nullable','date'],
            'meta' => ['nullable','array'],
        ]);

        $sub = Subscription::query()->firstOrNew([
            'establishment_id' => $establishment->id,
        ]);

        $data['plan'] = SubscriptionService::normalizePlan($data['plan']);

        // L'historique de la demande est conservé ; une demande de changement
        // d'offre est soldée dès que le super admin tranche.
        $meta = is_array($sub->meta) ? $sub->meta : [];
        unset($meta['plan_change_request']);
        $data['meta'] = array_merge($meta, $data['meta'] ?? []);

        // Activation (règlement reçu) : la période facturée démarre maintenant,
        // sinon les dates de la période d'essai resteraient affichées.
        if ($data['status'] === 'active' && $sub->status !== 'active' && empty($data['current_period_start'])) {
            $yearly = ($data['meta']['billing_cycle'] ?? 'month') === 'year';
            $data['current_period_start'] = now();
            $data['current_period_end'] = $yearly ? now()->addYear() : now()->addMonth();
        }

        if ($data['status'] === 'canceled') {
            $data['canceled_at'] = $data['canceled_at'] ?? now();
        } elseif (!array_key_exists('canceled_at', $data)) {
            $data['canceled_at'] = null;
        }

        $sub->fill($data);
        $sub->establishment_id = $establishment->id;
        $sub->save();

        return response()->json(SubscriptionService::present($sub->fresh()));
    }
}
