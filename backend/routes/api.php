<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\EstablishmentController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Controllers\Api\AgentTicketController;
use App\Http\Controllers\Api\AgentServiceController;
use App\Http\Controllers\Api\Admin\EstablishmentController as AdminEstablishmentController;
use App\Http\Controllers\Api\Admin\ServiceController as AdminServiceController;
use App\Http\Controllers\Api\Admin\AgentController as AdminAgentController;
use App\Http\Controllers\Api\Admin\StatsController as AdminStatsController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| Ces routes exposent l'API REST consommée par le web (React) et mobile (Flutter).
| Elles sont groupées par domaines fonctionnels et sécurisées via Sanctum et Policies.
*/

// Authentification et gestion des devices
Route::prefix('auth')->group(function () {
    // Inscription d'un utilisateur (user/agent/admin selon workflow adm)
    Route::post('register', [AuthController::class, 'register']);
    // Connexion (retourne un token personnel pour appels API)
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:api');
    // Déconnexion (révocation du token courant)
    Route::middleware('auth:sanctum')->post('logout', [AuthController::class, 'logout']);
    // Enregistrement / mise à jour du device FCM pour notifications push
    Route::middleware('auth:sanctum')->post('devices/register', [DeviceController::class, 'register']);
});

// Établissements (public: recherche; détails: public)
Route::get('establishments', [EstablishmentController::class, 'index']); // ?lat&lng&radius
Route::get('establishments/search', [EstablishmentController::class, 'search']); // ?q
Route::get('establishments/{id}', [EstablishmentController::class, 'show']);
Route::get('establishments/{id}/services', [ServiceController::class, 'byEstablishment']);

// Services (lecture publique)
Route::get('services/{id}', [ServiceController::class, 'show']);
Route::get('services/{id}/affluence', [ServiceController::class, 'affluence']);
Route::get('services/{id}/recommendations', [ServiceController::class, 'recommendations']);

// Espace utilisateur authentifié (tickets)
Route::middleware('auth:sanctum')->group(function () {
    // CRUD tickets utilisateur
    Route::post('tickets', [TicketController::class, 'store']);
    Route::get('tickets/active', [TicketController::class, 'active']);
    Route::get('tickets/history', [TicketController::class, 'history']);
    Route::get('tickets/{ticket}', [TicketController::class, 'show']);
    Route::patch('tickets/{ticket}', [TicketController::class, 'update']); // action=cancel

    // Espace agent / admin (gestion des files en temps réel)
    Route::middleware('role:agent,admin')->group(function () {
        // Appeler le prochain ticket (algorithme serveur)
        Route::post('services/{service}/call-next', [AgentTicketController::class, 'callNext']);
        // Marquer un ticket absent
        Route::post('tickets/{ticket}/mark-absent', [AgentTicketController::class, 'markAbsent']);
        // Rappeler un ticket
        Route::post('tickets/{ticket}/recall', [AgentTicketController::class, 'recall']);
        // Clôturer un service (fin de journée, incidents, etc.)
        Route::post('services/{service}/close', [AgentServiceController::class, 'close']);
    });

    // Espace administrateur (gestion référentiel + stats)
    Route::prefix('admin')->middleware('role:admin')->group(function () {
        Route::apiResource('establishments', AdminEstablishmentController::class);
        Route::apiResource('services', AdminServiceController::class);
        Route::apiResource('agents', AdminAgentController::class);

        Route::get('stats/overview', [AdminStatsController::class, 'overview']);
        Route::get('stats/services/{serviceId}', [AdminStatsController::class, 'service']);
    });
});

// Authentification pour canaux de broadcast via Sanctum (Echo auth)
Route::post('broadcasting/auth', function (Request $request) {
    return Broadcast::auth($request);
})->middleware('auth:sanctum');
