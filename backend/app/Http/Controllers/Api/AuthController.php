<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Http\Requests\RegisterRequest;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    /**
     * Inscription d'un utilisateur (rôle par défaut: user, ou admin si establishment fourni)
     */
    public function register(RegisterRequest $request)
    {
        $data = $request->validated();

        // Déterminer le rôle: admin si establishment_name est fourni, sinon user
        $role = !empty($data['establishment_name']) ? 'admin' : 'user';

        // Création sécurisée de l'utilisateur
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'phone' => $data['phone'] ?? null,
            'role' => $role,
        ]);

        // Créer l'établissement si les champs sont fournis
        $establishment = null;
        if (!empty($data['establishment_name'])) {
            $establishment = \App\Models\Establishment::create([
                'name' => $data['establishment_name'],
                'address' => $data['establishment_address'] ?? null,
                'lat' => $data['establishment_lat'] ?? null,
                'lng' => $data['establishment_lng'] ?? null,
                'open_at' => $data['establishment_open_at'] ?? null,
                'close_at' => $data['establishment_close_at'] ?? null,
                'is_active' => true,
            ]);

            // Lier l'admin à l'établissement
            $user->establishment_id = $establishment->id;
            $user->save();
        }

        // Émission d'un token d'accès personnel (Sanctum)
        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'establishment_id' => $user->establishment_id,
            ],
            'establishment' => $establishment ? [
                'id' => $establishment->id,
                'name' => $establishment->name,
                'lat' => $establishment->lat,
                'lng' => $establishment->lng,
            ] : null,
            'token' => $token,
        ], Response::HTTP_CREATED);
    }

    /**
     * Connexion par email/mot de passe et émission d'un token Sanctum
     */
    public function login(LoginRequest $request)
    {
        $user = User::where('email', $request->validated('email'))->first();

        if (!$user || !Hash::check($request->validated('password'), (string) $user->password)) {
            return response()->json(['message' => 'E-mail ou mot de passe incorrect.'], Response::HTTP_UNAUTHORIZED);
        }

        // Agent désactivé par son administrateur
        if ($user->isInactive()) {
            return response()->json(['message' => 'Compte désactivé. Contactez votre administrateur.'], Response::HTTP_FORBIDDEN);
        }

        return $this->issueSession($user);
    }

    /**
     * Émet un token Sanctum et la réponse de session commune aux connexions
     * (e-mail / Google). establishment_id évite au web un passage par l'écran de
     * création d'établissement juste après la connexion d'un admin.
     */
    private function issueSession(User $user, int $status = Response::HTTP_OK)
    {
        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken('api')->plainTextToken;

        $userResponse = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'avatar' => $user->avatar,
            'establishment_id' => $user->establishment_id,
        ];

        // Services assignés (agents / admins)
        if ($user->role === 'agent' || $user->role === 'admin') {
            $userResponse['services'] = $user->services()
                ->get(['services.id', 'services.name', 'services.status', 'services.avg_service_time_minutes'])
                ->map(fn ($service) => [
                    'id' => $service->id,
                    'name' => $service->name,
                    'status' => $service->status ?? 'closed',
                    'avg_service_time_minutes' => $service->avg_service_time_minutes,
                ])->values()->toArray();
        }

        return response()->json([
            'user' => $userResponse,
            'token' => $token,
        ], $status);
    }

    /**
     * Déconnexion: révocation du token courant
     */
    public function logout(Request $request)
    {
        $request->user()?->currentAccessToken()?->delete();
        return response()->json(['message' => 'Logged out']);
    }

    /**
     * Vérifie un ID token Google et retourne ses claims, ou une réponse d'erreur.
     *
     * L'audience (aud) DOIT correspondre à un client OAuth de l'application : sans
     * ce contrôle, un ID token émis pour n'importe quelle autre application Google
     * permettrait de se connecter au compte SmartQueue de cet email.
     */
    private function verifyGoogleIdToken(string $idToken): array|\Illuminate\Http\JsonResponse
    {
        $googleResponse = Http::timeout(10)->get('https://oauth2.googleapis.com/tokeninfo', [
            'id_token' => $idToken,
        ]);

        if (!$googleResponse->ok()) {
            return response()->json(['message' => 'Connexion Google invalide. Réessayez.'], Response::HTTP_UNAUTHORIZED);
        }

        $googleUser = (array) $googleResponse->json();

        $allowedAudiences = array_values(array_filter(array_map(
            'trim',
            explode(',', (string) config('services.google.client_ids', ''))
        )));
        if (!empty($allowedAudiences)) {
            if (!in_array($googleUser['aud'] ?? null, $allowedAudiences, true)) {
                return response()->json(['message' => 'Connexion Google refusée pour cette application.'], Response::HTTP_UNAUTHORIZED);
            }
        } else {
            \Log::warning('GOOGLE_CLIENT_IDS non configuré : audience des ID tokens Google non vérifiée');
        }

        if (!in_array($googleUser['iss'] ?? null, ['accounts.google.com', 'https://accounts.google.com'], true)) {
            return response()->json(['message' => 'Connexion Google invalide. Réessayez.'], Response::HTTP_UNAUTHORIZED);
        }

        // Vérifier que l'email est vérifié par Google
        if (empty($googleUser['email']) || !isset($googleUser['email_verified']) || !filter_var($googleUser['email_verified'], FILTER_VALIDATE_BOOLEAN)) {
            return response()->json(['message' => "L'adresse e-mail de ce compte Google n'est pas vérifiée."], Response::HTTP_UNAUTHORIZED);
        }

        return $googleUser;
    }

    /**
     * Connexion avec Google
     */
    public function googleLogin(Request $request)
    {
        $request->validate([
            'id_token' => 'required|string',
        ]);

        $googleUser = $this->verifyGoogleIdToken((string) $request->id_token);
        if ($googleUser instanceof \Illuminate\Http\JsonResponse) {
            return $googleUser;
        }

        // Chercher ou créer l'utilisateur
        $user = User::where('email', $googleUser['email'])->first();

        if (!$user) {
            // Créer un nouvel utilisateur automatiquement
            $user = User::create([
                'name' => $googleUser['name'] ?? explode('@', $googleUser['email'])[0],
                'email' => $googleUser['email'],
                'password' => Hash::make(\Illuminate\Support\Str::random(32)), // Mot de passe aléatoire
                'phone' => null,
                'role' => 'user',
                'google_id' => $googleUser['sub'] ?? null,
                'avatar' => $googleUser['picture'] ?? null,
            ]);
        } else {
            if ($user->isInactive()) {
                return response()->json(['message' => 'Compte désactivé. Contactez votre administrateur.'], Response::HTTP_FORBIDDEN);
            }
            // Mettre à jour les infos Google si nécessaire
            if (empty($user->google_id)) {
                $user->update([
                    'google_id' => $googleUser['sub'] ?? null,
                    'avatar' => $googleUser['picture'] ?? null,
                ]);
            }
        }

        return $this->issueSession($user);
    }

    /**
     * Inscription avec Google (avec phone optionnel)
     */
    public function googleRegister(Request $request)
    {
        $request->validate([
            'id_token' => 'required|string',
            'phone' => 'nullable|string|max:20',
        ]);

        $googleUser = $this->verifyGoogleIdToken((string) $request->id_token);
        if ($googleUser instanceof \Illuminate\Http\JsonResponse) {
            return $googleUser;
        }

        // Vérifier si l'utilisateur existe déjà
        $existingUser = User::where('email', $googleUser['email'])->first();

        if ($existingUser) {
            if ($existingUser->isInactive()) {
                return response()->json(['message' => 'Compte désactivé. Contactez votre administrateur.'], Response::HTTP_FORBIDDEN);
            }
            // Mettre à jour le phone si fourni
            if ($request->phone && !$existingUser->phone) {
                $existingUser->update(['phone' => $request->phone]);
            }

            return $this->issueSession($existingUser);
        }

        // Créer un nouvel utilisateur
        $user = User::create([
            'name' => $googleUser['name'] ?? explode('@', $googleUser['email'])[0],
            'email' => $googleUser['email'],
            'password' => Hash::make(\Illuminate\Support\Str::random(32)),
            'phone' => $request->phone,
            'role' => 'user',
            'google_id' => $googleUser['sub'] ?? null,
            'avatar' => $googleUser['picture'] ?? null,
        ]);

        return $this->issueSession($user, Response::HTTP_CREATED);
    }
}
