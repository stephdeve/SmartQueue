<?php

namespace App\Http\Controllers\Api\Saas;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;
use App\Models\Subscription;
use App\Models\Ticket;
use App\Services\SubscriptionService;

class MonitoringController extends Controller
{
    /** Expression SQL "date du jour" (Y-m-d) d'une colonne, selon le moteur. */
    private function dayExpr(string $column): string
    {
        return match (DB::connection()->getDriverName()) {
            'pgsql' => "to_char(date_trunc('day', {$column}), 'YYYY-MM-DD')",
            'sqlite' => "date({$column})",
            default => "DATE({$column})",
        };
    }

    /**
     * Vue d'ensemble de la plateforme, calculée sur la base (aucune valeur simulée).
     * Query : days = 7 | 30 | 90 (période des courbes et des moyennes, 30 par défaut).
     */
    public function overview(Request $request)
    {
        $days = (int) $request->query('days', 30);
        if (!in_array($days, [7, 30, 90], true)) {
            $days = 30;
        }
        $since = now()->startOfDay()->subDays($days - 1);
        $today = now()->toDateString();
        $noShow = Ticket::noShowSql();

        // Établissements
        $establishments = DB::table('establishments')->count();
        $establishmentsActive = DB::table('establishments')->where('is_active', true)->count();
        $establishmentsNew = DB::table('establishments')->where('created_at', '>=', $since)->count();

        // Services / guichets
        $servicesOpen = DB::table('services')->where('status', 'open')->count();
        $servicesClosed = DB::table('services')->where('status', '!=', 'open')->count();
        $countersOpen = DB::table('counters')->where('status', 'open')->count();
        $countersClosed = DB::table('counters')->where('status', '!=', 'open')->count();

        // Tickets du jour (file du jour : valid_date)
        $todayRow = DB::table('tickets')
            ->whereDate('valid_date', $today)
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN tickets.status = 'waiting' THEN 1 ELSE 0 END) as waiting,
                SUM(CASE WHEN tickets.status IN ('called', 'en_route', 'present') THEN 1 ELSE 0 END) as called,
                SUM(CASE WHEN {$noShow} THEN 1 ELSE 0 END) as absent,
                SUM(CASE WHEN tickets.status = 'closed' THEN 1 ELSE 0 END) as processed
            ")
            ->first();

        // Moyennes sur la période (calcul en PHP pour rester portable entre moteurs)
        $rows = DB::table('tickets')
            ->where('created_at', '>=', $since)
            ->whereNotNull('called_at')
            ->select(['created_at', 'called_at', 'closed_at', 'status'])
            ->limit(5000)
            ->get();
        [$wSum, $wN, $sSum, $sN] = [0, 0, 0, 0];
        foreach ($rows as $row) {
            $created = Carbon::parse($row->created_at);
            $called = Carbon::parse($row->called_at);
            if ($called->gt($created)) { $wSum += $created->diffInMinutes($called); $wN++; }
            if ($row->status === 'closed' && $row->closed_at) {
                $closed = Carbon::parse($row->closed_at);
                if ($closed->gt($called)) { $sSum += $called->diffInMinutes($closed); $sN++; }
            }
        }

        $reviews = DB::table('reviews')
            ->where('created_at', '>=', $since)
            ->selectRaw('COUNT(*) as n, AVG(rating) as avg_rating')
            ->first();

        // Abonnements
        $subscriptionsByStatus = DB::table('subscriptions')
            ->selectRaw('status, COUNT(*) as n')
            ->groupBy('status')
            ->pluck('n', 'status')
            ->map(fn ($n) => (int) $n);

        $subscriptionsByPlan = [];
        $mrr = 0;
        foreach (Subscription::query()->get(['plan', 'status', 'meta']) as $sub) {
            $plan = SubscriptionService::normalizePlan($sub->plan) ?? (string) $sub->plan;
            $subscriptionsByPlan[$plan] = ($subscriptionsByPlan[$plan] ?? 0) + 1;
            if ($sub->status === 'active') {
                $mrr += SubscriptionService::monthlyAmount($sub->plan, $sub->meta['billing_cycle'] ?? 'month');
            }
        }

        // Courbe quotidienne : nouveaux établissements et tickets créés
        $ticketsPerDay = DB::table('tickets')
            ->where('created_at', '>=', $since)
            ->selectRaw($this->dayExpr('created_at').' as d, COUNT(*) as n')
            ->groupByRaw($this->dayExpr('created_at'))
            ->pluck('n', 'd');
        $establishmentsPerDay = DB::table('establishments')
            ->where('created_at', '>=', $since)
            ->selectRaw($this->dayExpr('created_at').' as d, COUNT(*) as n')
            ->groupByRaw($this->dayExpr('created_at'))
            ->pluck('n', 'd');
        $timeline = [];
        for ($day = $since->copy(); $day->lte(now()); $day->addDay()) {
            $key = $day->toDateString();
            $timeline[] = [
                'date' => $key,
                'tickets' => (int) ($ticketsPerDay[$key] ?? 0),
                'establishments' => (int) ($establishmentsPerDay[$key] ?? 0),
            ];
        }

        return response()->json([
            'days' => $days,
            'establishments' => (int) $establishments,
            'establishments_active' => (int) $establishmentsActive,
            'establishments_new' => (int) $establishmentsNew,
            'services' => [
                'total' => (int) ($servicesOpen + $servicesClosed),
                'open' => (int) $servicesOpen,
                'closed' => (int) $servicesClosed,
            ],
            'counters' => [
                'total' => (int) ($countersOpen + $countersClosed),
                'open' => (int) $countersOpen,
                'closed' => (int) $countersClosed,
            ],
            'tickets' => [
                'total' => (int) ($todayRow->total ?? 0),
                'waiting' => (int) ($todayRow->waiting ?? 0),
                'called' => (int) ($todayRow->called ?? 0),
                'absent' => (int) ($todayRow->absent ?? 0),
                'processed' => (int) ($todayRow->processed ?? 0),
                'period_total' => (int) array_sum(array_column($timeline, 'tickets')),
            ],
            'performance' => [
                'avg_wait_time' => $wN > 0 ? (int) round($wSum / $wN) : null,
                'avg_service_time' => $sN > 0 ? (int) round($sSum / $sN) : null,
                'rating_avg' => ($reviews->n ?? 0) > 0 ? round((float) $reviews->avg_rating, 1) : null,
                'reviews_count' => (int) ($reviews->n ?? 0),
            ],
            'subscriptions_by_status' => $subscriptionsByStatus,
            'subscriptions_by_plan' => $subscriptionsByPlan,
            'mrr_estimate' => $mrr,
            'currency' => config('plans.currency', 'FCFA'),
            'users_by_role' => DB::table('users')->selectRaw('role, COUNT(*) as n')->groupBy('role')->pluck('n', 'role')->map(fn ($n) => (int) $n),
            'timeline' => $timeline,
            'system' => $this->systemHealth(),
        ]);
    }

    /** Mesures serveur (null quand l'information n'est pas disponible sur l'hôte). */
    private function systemHealth(): array
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

        return [
            'uptime' => $uptime,
            'cpu_usage' => $cpuUsage,
            'memory_usage' => $memUsage,
            'disk_usage' => $diskUsage,
            'db_status' => $dbStatus,
            'cache_status' => $cacheStatus,
            'pending_jobs' => Schema::hasTable('jobs') ? DB::table('jobs')->count() : null,
            'failed_jobs' => Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : null,
        ];
    }

    /**
     * Santé de la plateforme (valeurs mesurées, aucune donnée simulée).
     */
    public function systemStats(Request $request)
    {
        $health = $this->systemHealth();
        $hasFailed = Schema::hasTable('failed_jobs');

        return response()->json([
            'total_users' => DB::table('users')->count(),
            'total_establishments' => DB::table('establishments')->count(),
            'users_by_role' => DB::table('users')->selectRaw('role, COUNT(*) as n')->groupBy('role')->pluck('n', 'role'),
            'uptime' => $health['uptime'],
            'cpu_usage' => $health['cpu_usage'],
            'memory_usage' => $health['memory_usage'],
            'disk_usage' => $health['disk_usage'],
            'db_status' => $health['db_status'],
            'cache_status' => $health['cache_status'],
            'pending_jobs' => $health['pending_jobs'],
            'failed_jobs' => $health['failed_jobs'],
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
     * Diagnostic de mise en production : indique si chaque service est configuré,
     * sans jamais renvoyer de secret (seulement « configuré / non configuré »).
     */
    public function config()
    {
        $mailer = (string) config('mail.default');
        $queue = (string) config('queue.default');
        $broadcast = (string) config('broadcasting.default');
        $cors = array_values(array_filter((array) config('cors.allowed_origins', [])));
        $googleIds = array_filter(array_map('trim', explode(',', (string) config('services.google.client_ids'))));
        $twilioReady = filled(config('services.twilio.sid')) && filled(config('services.twilio.token')) && filled(config('services.twilio.from'));

        // Signaux de vie écrits par le planificateur (chaque minute) et par un job
        // de la file (toutes les 5 minutes) : voir routes/console.php
        $beat = function (string $key, int $maxAgeMinutes): array {
            $raw = Cache::get($key);
            if (!$raw) {
                return [null, false];
            }
            $at = Carbon::parse($raw);

            return [$at->toIso8601String(), $at->gt(now()->subMinutes($maxAgeMinutes))];
        };
        [$schedulerAt, $schedulerOk] = $beat('heartbeat:scheduler', 5);
        [$queueAt, $queueOk] = $beat('heartbeat:queue', 15);

        $check = fn (string $key, string $label, string $value, string $level, string $hint) => compact('key', 'label', 'value', 'level', 'hint');

        $checks = [
            $check('app_env', 'Environnement', (string) config('app.env'),
                config('app.env') === 'production' ? 'ok' : 'warning', 'APP_ENV=production'),
            $check('app_debug', 'Mode debug', config('app.debug') ? 'activé' : 'désactivé',
                config('app.debug') ? 'error' : 'ok', 'APP_DEBUG=false : en mode debug, les erreurs exposent le code et la configuration'),
            $check('timezone', 'Fuseau horaire', (string) config('app.timezone'),
                config('app.timezone') === 'UTC' ? 'warning' : 'ok', 'APP_TIMEZONE=Africa/Porto-Novo : les horaires des services sont en heure locale'),
            $check('frontend_url', 'URL du site web', (string) (config('app.frontend_url') ?: '—'),
                config('app.frontend_url') ? 'ok' : 'warning', 'FRONTEND_URL : utilisée dans le lien des e-mails de réinitialisation'),
            $check('mail', 'E-mails', $mailer,
                in_array($mailer, ['log', 'array'], true) ? 'error' : 'ok', "MAIL_MAILER (smtp, resend…) et MAIL_* : sinon aucun e-mail de réinitialisation n'est envoyé"),
            $check('queue', 'File de jobs', $queue,
                $queue === 'sync' ? 'warning' : 'ok', 'QUEUE_CONNECTION=database : en « sync », les envois push/SMS ralentissent les requêtes'),
            $check('queue_worker', 'Worker de jobs', $queueAt ? 'dernier signal '.$queueAt : 'aucun signal',
                ($queue === 'sync' || $queueOk) ? 'ok' : 'error', 'php artisan queue:work (RUN_QUEUE_WORKER=true dans start.sh) : sinon push et SMS ne partent pas'),
            $check('scheduler', 'Planificateur', $schedulerAt ? 'dernier signal '.$schedulerAt : 'aucun signal',
                $schedulerOk ? 'ok' : 'error', 'php artisan schedule:work (RUN_SCHEDULER=true) : expiration des appels, reports, clôture de journée'),
            $check('broadcasting', 'Temps réel', $broadcast,
                in_array($broadcast, ['null', 'log'], true) ? 'error' : 'ok', 'BROADCAST_CONNECTION=reverb et REVERB_* : sinon les écrans ne se mettent plus à jour'),
            $check('push', 'Notifications push (FCM natif)', filled(config('services.firebase.service_account_json')) ? 'configuré' : 'non configuré',
                filled(config('services.firebase.service_account_json')) ? 'ok' : 'warning', "FIREBASE_SERVICE_ACCOUNT_JSON : requis pour les jetons FCM natifs (les jetons Expo n'en ont pas besoin)"),
            $check('sms', 'SMS (Twilio)', $twilioReady ? 'configuré' : 'non configuré',
                $twilioReady ? 'ok' : 'warning', 'TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM'),
            $check('google', 'Connexion Google', $googleIds ? count($googleIds).' client(s) OAuth' : 'non configuré',
                $googleIds ? 'ok' : 'warning', "GOOGLE_CLIENT_IDS : sans liste, l'audience des jetons Google n'est pas vérifiée"),
            $check('cors', 'Origines autorisées (CORS)', $cors ? implode(', ', $cors) : '—',
                in_array('*', $cors, true) ? 'warning' : 'ok', 'CORS_ALLOWED_ORIGINS=https://votre-domaine (au lieu de *)'),
        ];

        return response()->json([
            'checks' => $checks,
            'plans' => SubscriptionService::catalog(),
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
