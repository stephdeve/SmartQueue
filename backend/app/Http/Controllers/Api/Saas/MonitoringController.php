<?php

namespace App\Http\Controllers\Api\Saas;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MonitoringController extends Controller
{
    public function overview(Request $request)
    {
        $establishments = DB::table('establishments')->count();
        $servicesOpen = DB::table('services')->where('status', 'open')->count();
        $servicesClosed = DB::table('services')->where('status', 'closed')->count();

        $countersOpen = DB::table('counters')->where('status', 'open')->count();
        $countersClosed = DB::table('counters')->where('status', 'closed')->count();

        $ticketsWaiting = DB::table('tickets')->where('status', 'waiting')->count();
        $ticketsCalled = DB::table('tickets')->where('status', 'called')->count();
        $ticketsAbsent = DB::table('tickets')->where('status', 'absent')->count();

        $subscriptionsByStatus = DB::table('subscriptions')
            ->selectRaw('status, COUNT(*) as n')
            ->groupBy('status')
            ->pluck('n', 'status');

        return response()->json([
            'establishments' => (int) $establishments,
            'services' => [
                'open' => (int) $servicesOpen,
                'closed' => (int) $servicesClosed,
            ],
            'counters' => [
                'open' => (int) $countersOpen,
                'closed' => (int) $countersClosed,
            ],
            'tickets' => [
                'waiting' => (int) $ticketsWaiting,
                'called' => (int) $ticketsCalled,
                'absent' => (int) $ticketsAbsent,
            ],
            'subscriptions_by_status' => $subscriptionsByStatus,
        ]);
    }

    /**
     * Santé de la plateforme (valeurs mesurées, aucune donnée simulée).
     */
    public function systemStats(Request $request)
    {
        $dbStatus = 'Healthy';
        try {
            DB::select('select 1');
        } catch (\Throwable $e) {
            $dbStatus = 'Down';
        }

        $cacheStatus = 'Active';
        try {
            Cache::put('saas:health', 1, 10);
            if (Cache::get('saas:health') !== 1) {
                $cacheStatus = 'Degraded';
            }
        } catch (\Throwable $e) {
            $cacheStatus = 'Down';
        }

        $diskTotal = @disk_total_space(storage_path());
        $diskFree = @disk_free_space(storage_path());
        $diskUsage = ($diskTotal && $diskFree !== false) ? round((1 - $diskFree / $diskTotal) * 100) : null;

        $load = function_exists('sys_getloadavg') ? sys_getloadavg() : false;
        $cpuinfo = @file_get_contents('/proc/cpuinfo');
        $cpus = $cpuinfo ? max(1, substr_count($cpuinfo, "\nprocessor") + (str_starts_with($cpuinfo, 'processor') ? 1 : 0)) : 1;
        $cpuUsage = $load ? min(100, round($load[0] / max(1, $cpus) * 100)) : null;

        $memUsage = null;
        $meminfo = @file_get_contents('/proc/meminfo');
        if ($meminfo && preg_match('/MemTotal:\s+(\d+)/', $meminfo, $t) && preg_match('/MemAvailable:\s+(\d+)/', $meminfo, $a)) {
            $memUsage = round((1 - ((int) $a[1]) / max(1, (int) $t[1])) * 100);
        }

        $uptime = null;
        $uptimeRaw = @file_get_contents('/proc/uptime');
        if ($uptimeRaw) {
            $seconds = (int) explode(' ', trim($uptimeRaw))[0];
            $uptime = sprintf('%dj %dh %dmin', intdiv($seconds, 86400), intdiv($seconds % 86400, 3600), intdiv($seconds % 3600, 60));
        }

        $hasJobs = Schema::hasTable('jobs');
        $hasFailed = Schema::hasTable('failed_jobs');

        return response()->json([
            'total_users' => DB::table('users')->count(),
            'total_establishments' => DB::table('establishments')->count(),
            'users_by_role' => DB::table('users')->selectRaw('role, COUNT(*) as n')->groupBy('role')->pluck('n', 'role'),
            'uptime' => $uptime,
            'cpu_usage' => $cpuUsage,
            'memory_usage' => $memUsage,
            'disk_usage' => $diskUsage,
            'db_status' => $dbStatus,
            'cache_status' => $cacheStatus,
            'pending_jobs' => $hasJobs ? DB::table('jobs')->count() : null,
            'failed_jobs' => $hasFailed ? DB::table('failed_jobs')->count() : null,
            'recent_logs' => $hasFailed
                ? DB::table('failed_jobs')->orderByDesc('id')->limit(10)->get(['id', 'queue', 'failed_at', 'exception'])
                    ->map(fn ($j) => [
                        'level' => 'error',
                        'type' => 'Job en échec ('.$j->queue.')',
                        'message' => mb_substr(strtok((string) $j->exception, "\n") ?: 'Job en échec', 0, 200),
                        'timestamp' => $j->failed_at,
                    ])->values()
                : [],
            'activity_logs' => DB::table('notification_logs')->orderByDesc('id')->limit(10)->get(['channel', 'type', 'status', 'created_at'])
                ->map(fn ($l) => [
                    'user' => 'Système',
                    'action' => "Notification {$l->channel} ({$l->type})",
                    'status' => $l->status,
                    'timestamp' => $l->created_at,
                ])->values(),
        ]);
    }

    /**
     * Actions d'exploitation. Seules les actions réellement implémentées sont acceptées.
     */
    public function systemAction(Request $request, string $action)
    {
        if ($action === 'cache-clear') {
            Artisan::call('cache:clear');
            return response()->json(['message' => 'Cache applicatif vidé']);
        }

        return response()->json([
            'message' => "Action « {$action} » non disponible depuis l'interface : à réaliser sur l'infrastructure (hébergeur / base de données).",
        ], 422);
    }
}
