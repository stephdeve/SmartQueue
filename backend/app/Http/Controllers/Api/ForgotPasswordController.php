<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Validation\Rules\Password as PasswordRules;

class ForgotPasswordController extends Controller
{
    /**
     * Envoyer un lien de réinitialisation par email.
     * Répond toujours 200 pour ne pas révéler si l'email existe.
     */
    public function sendResetLink(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate(['email' => 'required|email|max:255']);

        try {
            Password::sendResetLink($request->only('email'));
        } catch (\Throwable $e) {
            // Serveur d'e-mails injoignable / mal configuré : on journalise sans exposer
            // l'erreur (ni l'existence du compte) à l'appelant.
            report($e);
        }

        return response()->json([
            'message' => 'Si un compte correspond à cet email, un lien de réinitialisation a été envoyé.',
        ]);
    }

    /**
     * Réinitialiser le mot de passe avec token + email.
     */
    public function reset(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate([
            'token'    => 'required|string',
            'email'    => 'required|email|max:255',
            'password' => ['required', 'confirmed', PasswordRules::min(8)],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, string $password) {
                $user->forceFill([
                    'password'       => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                // Révoquer tous les tokens existants
                $user->tokens()->delete();

                event(new PasswordReset($user));
            },
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Mot de passe réinitialisé avec succès.']);
        }

        return response()->json([
            'message' => match ($status) {
                Password::INVALID_TOKEN => 'Token invalide ou expiré. Refaites une demande.',
                Password::INVALID_USER  => 'Aucun compte trouvé avec cet email.',
                default                 => 'Erreur lors de la réinitialisation.',
            },
        ], 422);
    }
}
