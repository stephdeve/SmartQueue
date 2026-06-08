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

        $this->app->make('Illuminate\Contracts\Debug\ExceptionHandler')->renderable(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }
            return null;
        });

        // Ticket lifecycle event → notification listener mapping
        Event::listen(TicketCreated::class,     [NotifyTicketLifecycle::class, 'handleCreated']);
        Event::listen(TicketDeferred::class,    [NotifyTicketLifecycle::class, 'handleDeferred']);
        Event::listen(TicketActivated::class,   [NotifyTicketLifecycle::class, 'handleActivated']);
        Event::listen(TicketExpiredAuto::class, [NotifyTicketLifecycle::class, 'handleExpired']);
    }
}
