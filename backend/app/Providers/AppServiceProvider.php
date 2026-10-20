<?php

namespace App\Providers;

use App\Events\TicketLifecycle\TicketActivated;
use App\Events\TicketLifecycle\TicketCreated;
use App\Events\TicketLifecycle\TicketDeferred;
use App\Events\TicketLifecycle\TicketExpiredAuto;
use App\Listeners\NotifyTicketLifecycle;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // Endpoints d'authentification publics : limite par e-mail + IP (anti force brute /
        // spam d'e-mails de réinitialisation), sans bloquer plusieurs agents derrière la même IP.
        RateLimiter::for('auth', function (Request $request) {
            $email = strtolower((string) $request->input('email', $request->input('admin_email', '')));
            return [
                Limit::perMinute(10)->by('auth:'.$email.'|'.$request->ip()),
                Limit::perMinute(60)->by('auth-ip:'.$request->ip()),
            ];
        });

        $this->app->make('Illuminate\Contracts\Debug\ExceptionHandler')->renderable(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            return null;
        });

        // URL de réinitialisation du mot de passe → pointe vers le frontend React
        \Illuminate\Auth\Notifications\ResetPassword::createUrlUsing(function ($user, string $token) {
            $frontendUrl = rtrim((string) (config('app.frontend_url') ?: config('app.url')), '/');
            return "{$frontendUrl}/reset-password?token={$token}&email=" . urlencode($user->email);
        });

        // Ticket lifecycle event → notification listener mapping
        Event::listen(TicketCreated::class,     [NotifyTicketLifecycle::class, 'handleCreated']);
        Event::listen(TicketDeferred::class,    [NotifyTicketLifecycle::class, 'handleDeferred']);
        Event::listen(TicketActivated::class,   [NotifyTicketLifecycle::class, 'handleActivated']);
        Event::listen(TicketExpiredAuto::class, [NotifyTicketLifecycle::class, 'handleExpired']);
    }
}
