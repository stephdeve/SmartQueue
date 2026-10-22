<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class ProfileController extends Controller
{
    /**
     * Mettre à jour le profil de l'utilisateur connecté.
     * Accepte name, phone, avatar (URL).
     */
    public function update(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'   => 'sometimes|string|max:255',
            'email'  => [
                'sometimes', 'email', 'max:190',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'phone'  => [
                'sometimes', 'nullable', 'string', 'max:32',
                Rule::unique('users', 'phone')->ignore($user->id),
            ],
            'avatar' => 'sometimes|nullable|string|max:1000',
        ]);

        $user->fill($validated)->save();

        return response()->json([
            'message' => 'Profil mis à jour avec succès.',
            'user'    => [
                'id'               => $user->id,
                'name'             => $user->name,
                'email'            => $user->email,
                'phone'            => $user->phone,
                'role'             => $user->role,
                'avatar'           => $user->avatar,
                'establishment_id' => $user->establishment_id,
            ],
        ]);
    }

    /**
     * Changer le mot de passe de l'utilisateur connecté.
     * Requiert current_password, password, password_confirmation.
     */
    public function changePassword(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'current_password' => 'required|string',
            'password'         => ['required', 'confirmed', Password::min(8)],
        ]);

        if (!Hash::check($request->current_password, (string) $user->password)) {
            return response()->json(['message' => 'Mot de passe actuel incorrect.'], 422);
        }

        $user->update(['password' => Hash::make($request->password)]);

        // Révoquer tous les autres tokens (sécurité)
        $currentTokenId = $user->currentAccessToken()->id;
        $user->tokens()->where('id', '!=', $currentTokenId)->delete();

        return response()->json(['message' => 'Mot de passe modifié avec succès.']);
    }

    /**
     * Supprimer définitivement le compte de l'usager connecté.
     *
     * Les tickets passés restent dans les statistiques des établissements (user_id
     * remis à null par la clé étrangère) ; les tickets en cours sont annulés pour
     * libérer la place dans la file. Les comptes agents/admins sont gérés par
     * l'établissement et ne peuvent pas s'auto-supprimer.
     */
    public function destroy(Request $request, TicketService $tickets): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'user') {
            return response()->json([
                'message' => "Les comptes agents et administrateurs sont gérés par l'établissement : contactez votre administrateur.",
            ], 403);
        }

        $request->validate(['password' => ['nullable', 'string']]);

        // Compte créé avec Google : pas de mot de passe connu de l'usager
        if (empty($user->google_id) && !Hash::check((string) $request->input('password'), (string) $user->password)) {
            return response()->json(['message' => 'Mot de passe incorrect.'], 422);
        }

        Ticket::query()
            ->where('user_id', $user->id)
            ->whereIn('status', TicketService::ACTIVE_STATUSES)
            ->get()
            ->each(function (Ticket $ticket) use ($tickets) {
                try {
                    $tickets->cancel($ticket);
                } catch (\Throwable $e) {
                    report($e);
                }
            });

        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            $user->notifications()->delete();
            $user->delete();
        });

        return response()->json(['message' => 'Votre compte a été supprimé.']);
    }
}
