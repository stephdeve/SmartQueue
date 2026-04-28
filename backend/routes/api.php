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
use App\Http\Controllers\Api\AgentQueueController;
use App\Http\Controllers\Api\AgentTicketActionController;
use App\Http\Controllers\Api\AgentCounterController;
use App\Http\Controllers\Api\Admin\EstablishmentController as AdminEstablishmentController;
use App\Http\Controllers\Api\Admin\ServiceController as AdminServiceController;
use App\Http\Controllers\Api\Admin\AgentController as AdminAgentController;
use App\Http\Controllers\Api\Admin\StatsController as AdminStatsController;
use App\Http\Controllers\Api\Admin\CounterController as AdminCounterController;
use App\Http\Controllers\Api\AlertPreferenceController;
use App\Http\Controllers\Api\TicketRecallController;
use App\Http\Controllers\Api\Admin\ReportExportController as AdminReportExportController;
use App\Http\Controllers\Api\Saas\EstablishmentController as SaasEstablishmentController;
use App\Http\Controllers\Api\Saas\SubscriptionController as SaasSubscriptionController;
use App\Http\Controllers\Api\Saas\MonitoringController as SaasMonitoringController;
use App\Http\Controllers\Api\OnboardingController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\NotificationPreferencesController;
use App\Http\Controllers\Api\Admin\PushNotificationController;
use App\Http\Controllers\Api\Admin\NotificationLogController;
use App\Http\Controllers\Api\Admin\TicketController as AdminTicketController;
use App\Http\Controllers\Api\Agent\DashboardController as AgentDashboardController;
use App\Http\Controllers\Api\ServiceQrCodeController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| Ces routes exposent l'API REST consommée par le web (React) et mobile (Flutter).
| Elles sont groupées par domaines fonctionnels et sécurisées via Sanctum et Policies.
*/

// QR Code scan (public endpoint, auth required for ticket creation)
Route::middleware('auth:sanctum')->post('qr-scan', [ServiceQrCodeController::class, 'scan']);

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
    // Google OAuth
    Route::post('google', [AuthController::class, 'googleLogin']);
    Route::post('google/register', [AuthController::class, 'googleRegister']);
});

// Onboarding SaaS (établissement -> abonnement)
Route::prefix('onboarding')->group(function () {
    Route::post('register-establishment', [OnboardingController::class, 'registerEstablishment']);
    Route::middleware('auth:sanctum')->post('subscribe', [OnboardingController::class, 'subscribe']);
});

// Établissements (public: recherche; détails: public)
Route::get('establishments', [EstablishmentController::class, 'index']); // ?lat&lng&radius
Route::get('establishments/nearby', [EstablishmentController::class, 'index']); // alias mobile: ?lat&lng&radius
Route::get('establishments/search', [EstablishmentController::class, 'search']); // ?q
Route::get('establishments/{id}', [EstablishmentController::class, 'show']);
Route::get('establishments/{id}/services', [ServiceController::class, 'byEstablishment']);

// Services (lecture publique)
Route::get('services/{id}', [ServiceController::class, 'show']);
Route::get('services/{id}/affluence', [ServiceController::class, 'affluence']);
Route::get('services/{id}/recommendations', [ServiceController::class, 'recommendations']);

// Espace utilisateur authentifié (tickets)
Route::middleware('auth:sanctum')->group(function () {
    // Profil utilisateur courant (utile front)
    Route::get('me', [OnboardingController::class, 'me']);

    // CRUD tickets utilisateur
    Route::post('tickets', [TicketController::class, 'store']);
    Route::get('tickets/me', [TicketController::class, 'active']); // alias mobile
    Route::get('tickets/active', [TicketController::class, 'active']);
    Route::get('tickets/history', [TicketController::class, 'history']);
    Route::get('tickets/{ticket}', [TicketController::class, 'show']);
    Route::patch('tickets/{ticket}', [TicketController::class, 'update']); // action=cancel

    // Notifications utilisateur
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'read']); // ou PUT si vous préférez
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    // User stats sync
    Route::post('/user/stats', [OnboardingController::class, 'syncUserStats']);

    // Préférences notifications (mobile/web)
    Route::get('/notification-preferences', [NotificationPreferencesController::class, 'show']);
    Route::put('/notification-preferences', [NotificationPreferencesController::class, 'update']);
    

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

        // Ouvrir un service à la volée
        Route::post('services/{service}/open', [AgentServiceController::class, 'open']);

        // Vue complète de la file (initialisation dashboard temps réel)
        Route::get('services/{service}/queue', [AgentQueueController::class, 'index']);

        // Actions ticket côté agent
        Route::post('tickets/{ticket}/close', [AgentTicketActionController::class, 'close']);
        Route::post('tickets/{ticket}/cancel', [AgentTicketActionController::class, 'cancel']);
        Route::post('tickets/{ticket}/priority', [AgentTicketActionController::class, 'setPriority']);
        Route::post('tickets/{ticket}/mark-absent', [AgentTicketActionController::class, 'markAbsent']);
        Route::post('tickets/{ticket}/defer', [AgentTicketActionController::class, 'defer']);

        // Ouverture/fermeture guichet (counter)
        Route::post('counters/{counter}/open', [AgentCounterController::class, 'open']);
        Route::post('counters/{counter}/close', [AgentCounterController::class, 'close']);

        // Tickets management for agents
        Route::get('agent/tickets', [AdminTicketController::class, 'index']);
        Route::get('agent/tickets/stats', [AdminTicketController::class, 'stats']);
        Route::get('agent/tickets/{ticketId}', [AdminTicketController::class, 'show']);

        // Agent Dashboard routes
        Route::get('agent/dashboard/stats', [AgentDashboardController::class, 'stats']);
        Route::get('agent/dashboard/today-tickets', [AgentDashboardController::class, 'todayTickets']);
        Route::get('agent/dashboard/current-queue', [AgentDashboardController::class, 'currentQueue']);
        Route::get('agent/dashboard/performance', [AgentDashboardController::class, 'performance']);
    });

    // Espace administrateur (gestion référentiel + stats)
    Route::prefix('admin')->middleware(['role:admin','admin.establishment'])->group(function () {
        Route::apiResource('establishments', AdminEstablishmentController::class);
        Route::apiResource('services', AdminServiceController::class);
        Route::apiResource('agents', AdminAgentController::class);
        Route::apiResource('counters', AdminCounterController::class);

        // QR Code management for services
        Route::post('services/{service}/qr-code', [ServiceQrCodeController::class, 'generate']);
        Route::get('services/{service}/qr-code', [ServiceQrCodeController::class, 'show']);
        Route::get('services/{service}/qr-code/download', [ServiceQrCodeController::class, 'download']);

        Route::get('stats/overview', [AdminStatsController::class, 'overview']);
        Route::get('stats/services/{serviceId}', [AdminStatsController::class, 'service']);
        Route::get('stats/series', [AdminStatsController::class, 'series']);

        // Tickets management
        Route::get('tickets', [AdminTicketController::class, 'index']);
        Route::get('tickets/stats', [AdminTicketController::class, 'stats']);
        Route::get('tickets/{ticketId}', [AdminTicketController::class, 'show']);

        // Exports
        Route::get('establishments/{establishment}/reports/activity.csv', [AdminReportExportController::class, 'activityCsv']);

        // Push notifications (FCM)
        Route::post('push/broadcast', [PushNotificationController::class, 'broadcast']);

        // Historique des notifications envoyées (logs)
        Route::get('notification-logs', [NotificationLogController::class, 'index']);
        Route::get('notification-logs/{id}', [NotificationLogController::class, 'show']);
        Route::patch('notification-logs/{id}', [NotificationLogController::class, 'update']);
    });

    // Espace super-admin SaaS (multi-établissements)
    Route::prefix('saas')->middleware('role:super_admin')->group(function () {
        Route::apiResource('establishments', SaasEstablishmentController::class);
        Route::get('subscriptions', [SaasSubscriptionController::class, 'index']);
        Route::put('establishments/{establishment}/subscription', [SaasSubscriptionController::class, 'upsert']);
        Route::get('monitoring/overview', [SaasMonitoringController::class, 'overview']);
    });

    // User alert preferences
    Route::prefix('user')->group(function () {
        Route::get('alert-preferences', [AlertPreferenceController::class, 'show']);
        Route::put('alert-preferences', [AlertPreferenceController::class, 'update']);
        Route::post('alert-preferences/reset', [AlertPreferenceController::class, 'reset']);
    });

    // Ticket recall (seconde chance) - for users
    Route::prefix('tickets')->group(function () {
        Route::post('{ticket}/request-recall', [TicketRecallController::class, 'recall']);
        Route::post('{ticket}/en-route', [TicketRecallController::class, 'enRoute']);
        Route::post('{ticket}/defer', [TicketRecallController::class, 'defer']); // User defers/swap position
        Route::get('{ticket}/countdown', [TicketRecallController::class, 'countdown']);
    });
});

// Authentification pour canaux de broadcast via Sanctum (Echo auth)
Route::post('broadcasting/auth', function (Request $request) {
    $channelName = $request->input('channel_name');
    $socketId = $request->input('socket_id');
    
    // Log for debugging
    \Log::info('Broadcasting auth request', [
        'channel_name' => $channelName,
        'socket_id' => $socketId,
        'user_id' => $request->user()?->id,
    ]);
    
    // Remove 'private-' or 'presence-' prefix if present
    $normalizedChannel = $channelName;
    if (str_starts_with($channelName, 'private-')) {
        $normalizedChannel = substr($channelName, 8);
    } elseif (str_starts_with($channelName, 'presence-')) {
        $normalizedChannel = substr($channelName, 9);
    }
    
    // Validate the channel and return auth signature
    if (str_starts_with($normalizedChannel, 'ticket.')) {
        // Private ticket channel - user must own the ticket
        $ticketId = (int) str_replace('ticket.', '', $normalizedChannel);
        $ticket = \App\Models\Ticket::find($ticketId);
        
        \Log::info('Ticket channel auth', ['ticket_id' => $ticketId, 'ticket_found' => !!$ticket, 'user_id' => $request->user()->id]);
        
        if (!$ticket || $ticket->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized for ticket channel');
        }
        
        // Generate auth signature for Reverb
        $pusherKey = env('REVERB_APP_KEY', 'smartqueue_key');
        $pusherSecret = env('REVERB_APP_SECRET', 'smartqueue_secret');
        // Sign with the ORIGINAL channel name (with private- prefix if present)
        $stringToSign = $socketId . ':' . $channelName;
        $signature = hash_hmac('sha256', $stringToSign, $pusherSecret);
        
        \Log::info('Generated auth signature', ['auth' => $pusherKey . ':' . $signature]);
        
        return response()->json([
            'auth' => $pusherKey . ':' . $signature,
        ]);
    }
    
    // Presence channel for service (agents/admins)
    if (str_starts_with($normalizedChannel, 'service.') || str_starts_with($normalizedChannel, 'presence-service.')) {
        // Handle both service.{id} and presence-service.{id}
        if (str_starts_with($normalizedChannel, 'presence-service.')) {
            $serviceId = (int) str_replace('presence-service.', '', $normalizedChannel);
        } else {
            $serviceId = (int) str_replace('service.', '', $normalizedChannel);
        }
        $user = $request->user();
        
        // For presence channels, agents/admins can join
        if ($user && in_array($user->role, ['agent', 'admin'])) {
            $pusherKey = env('REVERB_APP_KEY', 'smartqueue_key');
            $pusherSecret = env('REVERB_APP_SECRET', 'smartqueue_secret');
            
            // Presence channel auth includes user data
            $userData = json_encode([
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
            ]);
            
            $stringToSign = $socketId . ':' . $channelName . ':' . $userData;
            $signature = hash_hmac('sha256', $stringToSign, $pusherSecret);
            
            \Log::info('Presence channel auth for agent', ['service_id' => $serviceId, 'user_id' => $user->id]);
            
            return response()->json([
                'auth' => $pusherKey . ':' . $signature,
                'channel_data' => $userData,
            ]);
        }
        
        // For regular users, check if they have active ticket
        $hasActiveTicket = \App\Models\Ticket::where('user_id', $user->id)
            ->where('service_id', $serviceId)
            ->whereIn('status', ['waiting', 'called', 'absent'])
            ->exists();
        
        if (!$hasActiveTicket) {
            abort(403, 'Unauthorized for service channel');
        }
        
        // Generate auth signature for Reverb
        $pusherKey = env('REVERB_APP_KEY', 'smartqueue_key');
        $pusherSecret = env('REVERB_APP_SECRET', 'smartqueue_secret');
        $stringToSign = $socketId . ':' . $channelName;
        $signature = hash_hmac('sha256', $stringToSign, $pusherSecret);
        
        return response()->json([
            'auth' => $pusherKey . ':' . $signature,
        ]);
    }
    
    // Default: use Laravel's built-in auth for other channels
    //vd
    return Broadcast::auth($request);
})->middleware('auth:sanctum');
