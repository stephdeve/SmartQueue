<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\OnboardingRegisterEstablishmentRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class OnboardingController extends Controller
{
    /**
     * Inscription d'un établissement (SaaS) + création du compte admin scoppé.
     * Retourne un token Sanctum et indique que l'étape suivante est l'abonnement.
     */
    public function registerEstablishment(OnboardingRegisterEstablishmentRequest $request)
    {
        $data = $request->validated();

        return DB::transaction(function () use ($data) {
            $admin = User::create([
                'name' => $data['admin_name'],
                'email' => $data['admin_email'],
                'password' => Hash::make($data['admin_password']),
                'phone' => $data['admin_phone'] ?? null,
                'role' => 'admin',
                'establishment_id' => null,
            ]);

            $token = $admin->createToken('api')->plainTextToken;

            return response()->json([
                'user' => [
                    'id' => $admin->id,
                    'name' => $admin->name,
                    'email' => $admin->email,
                    'phone' => $admin->phone,
                    'role' => $admin->role,
                    'establishment_id' => $admin->establishment_id,
                ],
                'token' => $token,
                'next_step' => 'subscription',
            ], Response::HTTP_CREATED);
        });
    }

    /**
     * Mock paiement: active l'abonnement de l'établissement de l'admin connecté.
     */
    public function subscribe(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            abort(401, 'Unauthenticated');
        }
        if (!in_array($user->role, ['user', 'admin'], true)) {
            abort(403, 'Forbidden');
        }

        $data = $request->validate([
            'plan' => ['required','string','max:32'],
            'paid' => ['required','boolean'],
        ]);

        if (!$data['paid']) {
            abort(422, 'Payment required');
        }

        $user->forceFill([
            'pending_subscription' => [
                'status' => 'active',
                'plan' => $data['plan'],
                'paid_at' => now()->toISOString(),
                'source' => 'onboarding',
            ],
        ])->save();

        // Promote newly subscribed user to admin (scoped admin must create establishment next)
        if ($user->role === 'user') {
            $user->forceFill([
                'role' => 'admin',
                'establishment_id' => null,
            ])->save();
        }

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'establishment_id' => $user->establishment_id,
                'pending_subscription' => $user->pending_subscription,
            ],
            'pending_subscription' => $user->pending_subscription,
            'next_step' => 'create_establishment',
        ]);
    }

    /**
     * Retourne l'utilisateur courant et son scope (utile pour le front).
     */
    public function me(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            abort(401, 'Unauthenticated');
        }

        $services = null;
        $counters = null;
        if (in_array($user->role, ['agent', 'admin'], true)) {
            $services = $user->services()
                ->select(['services.id', 'services.name', 'services.status', 'services.avg_service_time_minutes', 'services.priority_support', 'services.capacity'])
                ->orderBy('services.name')
                ->get();

            if (!empty($user->establishment_id)) {
                $counters = \App\Models\Counter::query()
                    ->where('establishment_id', $user->establishment_id)
                    ->select(['id', 'name', 'status', 'current_agent_id'])
                    ->orderBy('name')
                    ->get();
            }
        }
        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'establishment_id' => $user->establishment_id,
            'pending_subscription' => $user->pending_subscription,
            'services' => $services,
            'counters' => $counters,
        ]);
    }

    /**
     * Sync user stats from frontend
     */
    public function syncUserStats(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            abort(401, 'Unauthenticated');
        }

        $validated = $request->validate([
            'totalTicketsCreated' => 'integer|min:0',
            'perfectTimingCount' => 'integer|min:0',
            'quickResponseCount' => 'integer|min:0',
            'weekendTickets' => 'integer|min:0',
            'currentXp' => 'integer|min:0',
            'currentLevel' => 'integer|min:1',
        ]);

        // Save to user meta/stats table or user profile
        $user->stats_data = json_encode($validated);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Stats synchronized successfully',
            'stats' => $validated,
        ]);
    }
}
