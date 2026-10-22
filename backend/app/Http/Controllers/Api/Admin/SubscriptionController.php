<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    /**
     * Abonnement de l'établissement de l'admin connecté.
     * (/saas/subscriptions est réservé au super admin : l'admin y recevait un 403.)
     */
    public function show(Request $request)
    {
        $user = $request->user();
        $establishmentId = $request->attributes->get('scoped_establishment_id') ?: $user->establishment_id;

        $subscription = $establishmentId
            ? Subscription::query()->where('establishment_id', (int) $establishmentId)->first()
            : null;

        return response()->json([
            'subscription' => SubscriptionService::present($subscription),
            'pending_subscription' => $user->pending_subscription,
            'catalog' => SubscriptionService::catalog(),
        ]);
    }
}
