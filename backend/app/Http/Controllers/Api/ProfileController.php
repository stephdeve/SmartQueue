<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
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
}
