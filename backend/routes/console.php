<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('tickets:notify-approaching')->everyMinute()->withoutOverlapping();
Schedule::command('tickets:expire-en-route')->everyMinute()->withoutOverlapping();
Schedule::command('tickets:expire-called')->everyMinute()->withoutOverlapping();
Schedule::command('tickets:expire-stale')->everyFiveMinutes()->withoutOverlapping();

// Smart queue lifecycle automation — runs every minute, each command sweeps
// services and fans out queueable jobs. All actions are idempotent so missed
// ticks recover on the next minute (no deferred ticket can be lost).
Schedule::command('queue:activate-deferred')->everyMinute()->withoutOverlapping();
Schedule::command('queue:check-overload')->everyMinute()->withoutOverlapping();
Schedule::command('queue:close-day')->everyMinute()->withoutOverlapping();
