<?php

namespace App\Services;

use App\Models\Subscription;
use App\Models\User;

/**
 * Offres (config/plans.php) et souscriptions des établissements.
 *
 * Aucun prestataire de paiement n'est branché : une souscription en ligne ouvre
 * une période d'essai et l'équipe SmartQueue passe l'abonnement en « actif »
 * depuis le back-office SaaS une fois le règlement reçu.
 */
class SubscriptionService
{
    /** Identifiant d'offre connu (anciens identifiants basic/pro acceptés), sinon null. */
    public static function normalizePlan(?string $plan): ?string
    {
        $plan = strtolower(trim((string) $plan));
        $plan = (string) config('plans.aliases.'.$plan, $plan);

        return array_key_exists($plan, (array) config('plans.plans', [])) ? $plan : null;
    }

    /** @return array<string, mixed>|null */
    public static function plan(?string $plan): ?array
    {
        $id = self::normalizePlan($plan);

        return $id ? ['id' => $id] + (array) config("plans.plans.$id") : null;
    }

    /** Montant mensuel effectivement facturé selon le cycle de facturation. */
    public static function monthlyAmount(?string $plan, ?string $cycle = 'month'): int
    {
        $details = self::plan($plan);
        if (!$details) {
            return 0;
        }

        $price = (int) $details['monthly_price'];
        if ($cycle === 'year') {
            $discount = (int) config('plans.annual_discount_percent', 0);
            $price = (int) round($price * (100 - $discount) / 100);
        }

        return $price;
    }

    /** Catalogue public des offres. */
    public static function catalog(): array
    {
        $plans = [];
        foreach ((array) config('plans.plans', []) as $id => $plan) {
            $plans[] = ['id' => $id] + $plan;
        }

        return [
            'currency' => config('plans.currency', 'FCFA'),
            'annual_discount_percent' => (int) config('plans.annual_discount_percent', 0),
            'trial_days' => (int) config('plans.trial_days', 30),
            'plans' => $plans,
        ];
    }

    /** Représentation d'une souscription pour les API (offre détaillée incluse). */
    public static function present(?Subscription $sub): ?array
    {
        if (!$sub) {
            return null;
        }

        $cycle = (string) ($sub->meta['billing_cycle'] ?? 'month');

        return [
            'id' => $sub->id,
            'establishment_id' => $sub->establishment_id,
            'plan' => self::normalizePlan($sub->plan) ?? $sub->plan,
            'plan_details' => self::plan($sub->plan),
            'status' => $sub->status,
            'billing_cycle' => $cycle,
            'monthly_amount' => self::monthlyAmount($sub->plan, $cycle),
            'current_period_start' => $sub->current_period_start?->toIso8601String(),
            'current_period_end' => $sub->current_period_end?->toIso8601String(),
            'canceled_at' => $sub->canceled_at?->toIso8601String(),
            'plan_change_request' => $sub->meta['plan_change_request'] ?? null,
            'created_at' => $sub->created_at?->toIso8601String(),
        ];
    }

    /**
     * Enregistre la demande d'abonnement de l'utilisateur sur son établissement.
     *
     * - pas encore d'abonnement : ouverture de la période d'essai ;
     * - abonnement actif (réglé) : la demande de changement est conservée pour validation ;
     * - sinon : l'offre est mise à jour sans relancer la période d'essai.
     */
    public function attachRequest(User $user, int $establishmentId, array $request): Subscription
    {
        $plan = self::normalizePlan($request['plan'] ?? null) ?? 'starter';
        $request['plan'] = $plan;

        $sub = Subscription::query()->firstOrNew(['establishment_id' => $establishmentId]);
        $meta = is_array($sub->meta) ? $sub->meta : [];

        if (!$sub->exists) {
            $sub->fill([
                'plan' => $plan,
                'status' => 'trial',
                'current_period_start' => now(),
                'current_period_end' => now()->addDays((int) config('plans.trial_days', 30)),
                'canceled_at' => null,
                'meta' => $request,
            ]);
        } elseif ($sub->status === 'active') {
            $meta['plan_change_request'] = $request;
            $sub->meta = $meta;
        } else {
            $sub->plan = $plan;
            $sub->meta = array_merge($meta, $request);
        }

        $sub->save();
        $user->forceFill(['pending_subscription' => null])->save();

        return $sub;
    }

    /** Matérialise la demande mise en attente avant la création de l'établissement. */
    public function materializePending(User $user, int $establishmentId): ?Subscription
    {
        $pending = $user->pending_subscription;
        if (!is_array($pending) || empty($pending)) {
            return null;
        }

        return $this->attachRequest($user, $establishmentId, $pending);
    }
}
