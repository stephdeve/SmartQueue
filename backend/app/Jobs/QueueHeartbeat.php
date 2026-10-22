<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Cache;

/**
 * Signal de vie de la file de jobs, affiché dans le diagnostic super admin :
 * s'il n'est plus rafraîchi, aucun worker ne traite la file (push/SMS bloqués).
 */
class QueueHeartbeat implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public function handle(): void
    {
        Cache::forever('heartbeat:queue', now()->toIso8601String());
    }
}
