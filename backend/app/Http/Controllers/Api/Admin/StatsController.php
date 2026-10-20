<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Service;
use App\Models\User;

class StatsController extends Controller
{
    /**
     * Période from/to de la requête. Une date seule (Y-m-d) en borne haute couvre
     * toute la journée (sinon "to=aujourd'hui" excluait les tickets du jour).
     *
     * @return array{0: \Illuminate\Support\Carbon, 1: \Illuminate\Support\Carbon}
     */
    private function parseRange(Request $request, int $defaultDays): array
    {
        try {
            $from = $request->query('from')
                ? \Illuminate\Support\Carbon::parse((string) $request->query('from'))
                : now()->subDays($defaultDays);
            $toRaw = (string) $request->query('to', '');
            $to = $toRaw !== '' ? \Illuminate\Support\Carbon::parse($toRaw) : now();
        } catch (\Throwable $e) {
            abort(422, 'Invalid date range');
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $toRaw)) {
            $to = $to->endOfDay();
        }

        return [$from, $to];
    }

    /**
     * Statistiques globales (période optionnelle from/to).
     */
    public function overview(Request $request)
    {
        [$from, $to] = $this->parseRange($request, 7);

        $scopedId = $request->attributes->get('scoped_establishment_id');

        // Base query for tickets with establishment filter
        $ticketQuery = function () use ($scopedId, $from, $to) {
            $query = DB::table('tickets')
                ->join('services', 'services.id', '=', 'tickets.service_id')
                ->whereBetween('tickets.created_at', [$from, $to]);

            if (!empty($scopedId)) {
                $query->where('services.establishment_id', (int) $scopedId);
            }

            return $query;
        };

        // Nombre total de tickets créés / clos / absents sur la période
        $totals = $ticketQuery()
            ->selectRaw("COUNT(*) as created,
                SUM(CASE WHEN tickets.status='closed' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN tickets.status='absent' THEN 1 ELSE 0 END) as absent")
            ->first();

        // Temps d'attente moyen (diff called_at - created_at) en minutes
        $rows = $ticketQuery()
            ->whereNotNull('tickets.called_at')
            ->select(['tickets.created_at','tickets.called_at'])
            ->limit(2000)
            ->get();
        $sum = 0; $n = 0;
        foreach ($rows as $r) {
            $created = \Illuminate\Support\Carbon::parse($r->created_at);
            $called = \Illuminate\Support\Carbon::parse($r->called_at);
            if ($called->greaterThan($created)) { $sum += $created->diffInMinutes($called); $n++; }
        }
        $waitAvg = $n > 0 ? (int) round($sum / $n) : null;

        // Agrégats services/agence (scope établissement pour admin)
        $services = null;
        if (!empty($scopedId)) {
            $activeServices = Service::query()
                ->where('establishment_id', (int) $scopedId)
                ->where('status', 'open')
                ->count();

            $agentsCount = User::query()
                ->where('role', 'agent')
                ->where('establishment_id', (int) $scopedId)
                ->count();

            $waitingCount = (int) (DB::table('tickets')
                ->join('services', 'services.id', '=', 'tickets.service_id')
                ->where('services.establishment_id', (int) $scopedId)
                ->where('tickets.status', 'waiting')
                ->count());

            $avgServiceTime = (int) round(Service::query()
                ->where('establishment_id', (int) $scopedId)
                ->avg('avg_service_time_minutes') ?? 0);

            $services = [
                'active' => (int) $activeServices,
                'agents' => (int) $agentsCount,
                'waiting' => (int) $waitingCount,
                'avgTime' => (int) $avgServiceTime,
            ];
        }

        return response()->json([
            'from' => $from->toDateTimeString(),
            'to' => $to->toDateTimeString(),
            'tickets' => [
                'created' => (int) ($totals->created ?? 0),
                'closed' => (int) ($totals->closed ?? 0),
                'absent' => (int) ($totals->absent ?? 0),
                'wait_avg_minutes' => $waitAvg,
            ],
            'services' => $services,
        ]);
    }

    /**
     * Statistiques pour un service spécifique.
     */
    public function service(int $serviceId, Request $request)
    {
        $scopedId = $request->attributes->get('scoped_establishment_id');

        $service = Service::query()
            ->when($scopedId, fn ($q) => $q->where('establishment_id', (int) $scopedId))
            ->findOrFail($serviceId);

        [$from, $to] = $this->parseRange($request, 7);

        $totals = DB::table('tickets')
            ->selectRaw("COUNT(*) as created,
                SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent")
            ->where('service_id', $serviceId)
            ->whereBetween('created_at', [$from, $to])
            ->first();

        // Durées de service (closed_at - called_at)
        $rows = DB::table('tickets')
            ->where('service_id', $serviceId)
            ->whereNotNull('closed_at')
            ->whereNotNull('called_at')
            ->where('closed_at', '>=', $from)
            ->select(['called_at','closed_at'])
            ->limit(2000)
            ->get();
        $sum = 0; $n = 0;
        foreach ($rows as $r) {
            $called = \Illuminate\Support\Carbon::parse($r->called_at);
            $closed = \Illuminate\Support\Carbon::parse($r->closed_at);
            if ($closed->greaterThan($called)) { $sum += $called->diffInMinutes($closed); $n++; }
        }
        $serviceAvg = $n > 0 ? (int) round($sum / $n) : (int) $service->avg_service_time_minutes;

        return response()->json([
            'service_id' => $serviceId,
            'from' => $from->toDateTimeString(),
            'to' => $to->toDateTimeString(),
            'tickets' => [
                'created' => (int) ($totals->created ?? 0),
                'closed' => (int) ($totals->closed ?? 0),
                'absent' => (int) ($totals->absent ?? 0),
                'service_time_avg_minutes' => $serviceAvg,
            ],
        ]);
    }

    /**
     * Analytics avancés : KPIs, par service, par priorité, par source, par heure, reportés.
     * Query params: period = today|week|month|custom + from/to (si custom)
     */
    public function advanced(Request $request): \Illuminate\Http\JsonResponse
    {
        $period = $request->input('period', 'week');
        [$from, $to] = match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week'  => [now()->subDays(7)->startOfDay(), now()->endOfDay()],
            'month' => [now()->subDays(30)->startOfDay(), now()->endOfDay()],
            default => [
                $request->query('from') ? now()->parse($request->query('from'))->startOfDay() : now()->subDays(7)->startOfDay(),
                $request->query('to')   ? now()->parse($request->query('to'))->endOfDay()     : now()->endOfDay(),
            ],
        };

        $scopedId = $request->attributes->get('scoped_establishment_id');

        $diffSec = (int) abs($from->diffInSeconds($to, false));
        $prevFrom = $from->copy()->subSeconds($diffSec);
        $prevTo   = $from->copy();

        $base = fn ($f, $t) => DB::table('tickets')
            ->join('services', 'services.id', '=', 'tickets.service_id')
            ->whereBetween('tickets.created_at', [$f, $t])
            ->when(!empty($scopedId), fn ($q) => $q->where('services.establishment_id', (int) $scopedId));

        // ── 1. KPIs ──────────────────────────────────────────────────────────
        $kRow = $base($from, $to)->selectRaw("
            COUNT(*) as total,
            SUM(CASE WHEN tickets.status = 'closed'  THEN 1 ELSE 0 END) as served,
            SUM(CASE WHEN tickets.status = 'absent'  THEN 1 ELSE 0 END) as absent,
            SUM(CASE WHEN tickets.status = 'expired' THEN 1 ELSE 0 END) as expired,
            SUM(CASE WHEN tickets.status IN ('waiting','called','en_route','present') THEN 1 ELSE 0 END) as active_now,
            SUM(CASE WHEN tickets.auto_deferred THEN 1 ELSE 0 END) as deferred
        ")->first();

        $pRow = $base($prevFrom, $prevTo)->selectRaw("
            COUNT(*) as total,
            SUM(CASE WHEN tickets.status = 'closed' THEN 1 ELSE 0 END) as served,
            SUM(CASE WHEN tickets.status = 'absent' THEN 1 ELSE 0 END) as absent
        ")->first();

        $waitRows = $base($from, $to)->whereNotNull('tickets.called_at')
            ->select(['tickets.created_at', 'tickets.called_at'])->limit(3000)->get();
        [$wSum, $wN] = [0, 0];
        foreach ($waitRows as $r) {
            $c1 = \Illuminate\Support\Carbon::parse($r->created_at);
            $c2 = \Illuminate\Support\Carbon::parse($r->called_at);
            if ($c2->gt($c1)) { $wSum += $c1->diffInMinutes($c2); $wN++; }
        }

        $svcRows = $base($from, $to)->whereNotNull('tickets.closed_at')->whereNotNull('tickets.called_at')
            ->select(['tickets.called_at', 'tickets.closed_at'])->limit(3000)->get();
        [$sSum, $sN] = [0, 0];
        foreach ($svcRows as $r) {
            $c1 = \Illuminate\Support\Carbon::parse($r->called_at);
            $c2 = \Illuminate\Support\Carbon::parse($r->closed_at);
            if ($c2->gt($c1)) { $sSum += $c1->diffInMinutes($c2); $sN++; }
        }

        $total  = (int) ($kRow->total ?? 0);
        $served = (int) ($kRow->served ?? 0);
        $absent = (int) ($kRow->absent ?? 0);
        $ca     = $served + $absent;

        $prevTotal  = (int) ($pRow->total ?? 0);
        $prevServed = (int) ($pRow->served ?? 0);
        $prevAbsent = (int) ($pRow->absent ?? 0);
        $prevCa     = $prevServed + $prevAbsent;

        $kpis = [
            'total'               => $total,
            'served'              => $served,
            'absent'              => $absent,
            'expired'             => (int) ($kRow->expired ?? 0),
            'active'              => (int) ($kRow->active_now ?? 0),
            'deferred'            => (int) ($kRow->deferred ?? 0),
            'wait_avg_minutes'    => $wN > 0 ? (int) round($wSum / $wN) : null,
            'service_avg_minutes' => $sN > 0 ? (int) round($sSum / $sN) : null,
            'absenteeism_rate'    => $ca > 0 ? round($absent / $ca * 100, 1) : 0,
            'completion_rate'     => $total > 0 ? round($served / $total * 100, 1) : 0,
        ];

        $prevKpis = [
            'total'            => $prevTotal,
            'served'           => $prevServed,
            'absent'           => $prevAbsent,
            'absenteeism_rate' => $prevCa > 0 ? round($prevAbsent / $prevCa * 100, 1) : 0,
            'completion_rate'  => $prevTotal > 0 ? round($prevServed / $prevTotal * 100, 1) : 0,
        ];

        // ── 2. Par service ────────────────────────────────────────────────────
        $svcAgg = $base($from, $to)->selectRaw("
            tickets.service_id,
            services.name as service_name,
            COUNT(*) as total,
            SUM(CASE WHEN tickets.status = 'closed'  THEN 1 ELSE 0 END) as served,
            SUM(CASE WHEN tickets.status = 'absent'  THEN 1 ELSE 0 END) as absent,
            SUM(CASE WHEN tickets.auto_deferred THEN 1 ELSE 0 END) as deferred,
            SUM(CASE WHEN tickets.priority = 'normal'  THEN 1 ELSE 0 END) as p_normal,
            SUM(CASE WHEN tickets.priority = 'high'    THEN 1 ELSE 0 END) as p_high,
            SUM(CASE WHEN tickets.priority = 'vip'     THEN 1 ELSE 0 END) as p_vip,
            SUM(CASE WHEN tickets.priority = 'urgence' THEN 1 ELSE 0 END) as p_urgence,
            SUM(CASE WHEN COALESCE(tickets.source,'app') = 'app'     THEN 1 ELSE 0 END) as s_app,
            SUM(CASE WHEN tickets.source = 'qr_scan' THEN 1 ELSE 0 END) as s_qr,
            SUM(CASE WHEN tickets.source = 'agent'   THEN 1 ELSE 0 END) as s_agent,
            SUM(CASE WHEN tickets.source = 'kiosk'   THEN 1 ELSE 0 END) as s_kiosk
        ")->groupBy('tickets.service_id', 'services.name')->orderByDesc('total')->get();

        $svcWaitRaw = $base($from, $to)->whereNotNull('tickets.called_at')
            ->select(['tickets.service_id', 'tickets.created_at', 'tickets.called_at'])->limit(5000)->get();
        $svcWaitMap = [];
        foreach ($svcWaitRaw as $r) {
            $c1 = \Illuminate\Support\Carbon::parse($r->created_at);
            $c2 = \Illuminate\Support\Carbon::parse($r->called_at);
            if ($c2->gt($c1)) {
                $svcWaitMap[$r->service_id] ??= [0, 0];
                $svcWaitMap[$r->service_id][0] += $c1->diffInMinutes($c2);
                $svcWaitMap[$r->service_id][1]++;
            }
        }

        $byService = $svcAgg->map(function ($r) use ($svcWaitMap) {
            $st = (int) $r->total; $ss = (int) $r->served; $sa = (int) $r->absent;
            $sca = $ss + $sa;
            [$wS, $wN] = $svcWaitMap[$r->service_id] ?? [0, 0];
            return [
                'service_id'       => $r->service_id,
                'service_name'     => $r->service_name,
                'total'            => $st,
                'served'           => $ss,
                'absent'           => $sa,
                'deferred'         => (int) $r->deferred,
                'wait_avg_minutes' => $wN > 0 ? (int) round($wS / $wN) : null,
                'absenteeism_rate' => $sca > 0 ? round($sa / $sca * 100, 1) : 0,
                'completion_rate'  => $st > 0  ? round($ss / $st * 100, 1) : 0,
                'priority'         => ['normal' => (int) $r->p_normal, 'high' => (int) $r->p_high, 'vip' => (int) $r->p_vip, 'urgence' => (int) $r->p_urgence],
                'source'           => ['app' => (int) $r->s_app, 'qr_scan' => (int) $r->s_qr, 'agent' => (int) $r->s_agent, 'kiosk' => (int) $r->s_kiosk],
            ];
        })->values()->toArray();

        // ── 3. Par priorité ───────────────────────────────────────────────────
        $prioAgg = $base($from, $to)->selectRaw("
            COALESCE(tickets.priority, 'normal') as priority,
            COUNT(*) as total,
            SUM(CASE WHEN tickets.status = 'closed' THEN 1 ELSE 0 END) as served,
            SUM(CASE WHEN tickets.status = 'absent' THEN 1 ELSE 0 END) as absent
        ")->groupByRaw("COALESCE(tickets.priority, 'normal')")->get();

        $prioWaitRaw = $base($from, $to)->whereNotNull('tickets.called_at')
            ->select(['tickets.priority', 'tickets.created_at', 'tickets.called_at'])->limit(5000)->get();
        $prioWaitMap = [];
        foreach ($prioWaitRaw as $r) {
            $p = $r->priority ?? 'normal';
            $c1 = \Illuminate\Support\Carbon::parse($r->created_at);
            $c2 = \Illuminate\Support\Carbon::parse($r->called_at);
            if ($c2->gt($c1)) {
                $prioWaitMap[$p] ??= [0, 0];
                $prioWaitMap[$p][0] += $c1->diffInMinutes($c2);
                $prioWaitMap[$p][1]++;
            }
        }

        $byPriority = $prioAgg->map(function ($r) use ($prioWaitMap) {
            $p = $r->priority; $pt = (int) $r->total; $ps = (int) $r->served; $pa = (int) $r->absent;
            [$wS, $wN] = $prioWaitMap[$p] ?? [0, 0];
            return [
                'priority'         => $p,
                'total'            => $pt,
                'served'           => $ps,
                'absent'           => $pa,
                'absenteeism_rate' => ($ps + $pa) > 0 ? round($pa / ($ps + $pa) * 100, 1) : 0,
                'wait_avg_minutes' => $wN > 0 ? (int) round($wS / $wN) : null,
            ];
        })->sortBy(fn ($r) => match ($r['priority']) {
            'urgence' => 0, 'vip' => 1, 'high' => 2, default => 3,
        })->values()->toArray();

        // ── 4. Par source ─────────────────────────────────────────────────────
        $srcAgg = $base($from, $to)->selectRaw("
            COALESCE(tickets.source, 'app') as source,
            COUNT(*) as total,
            SUM(CASE WHEN tickets.status = 'closed' THEN 1 ELSE 0 END) as served,
            SUM(CASE WHEN tickets.status = 'absent' THEN 1 ELSE 0 END) as absent
        ")->groupByRaw("COALESCE(tickets.source, 'app')")->get();

        $bySource = $srcAgg->map(function ($r) {
            $st = (int) $r->total; $ss = (int) $r->served; $sa = (int) $r->absent;
            return [
                'source'           => $r->source,
                'total'            => $st,
                'served'           => $ss,
                'absent'           => $sa,
                'absenteeism_rate' => ($ss + $sa) > 0 ? round($sa / ($ss + $sa) * 100, 1) : 0,
                'completion_rate'  => $st > 0 ? round($ss / $st * 100, 1) : 0,
            ];
        })->values()->toArray();

        // ── 5. Par heure ──────────────────────────────────────────────────────
        $driver   = DB::connection()->getDriverName();
        $hourExpr = match ($driver) {
            'pgsql'  => "EXTRACT(HOUR FROM tickets.created_at)::int",
            'sqlite' => "CAST(strftime('%H', tickets.created_at) AS INTEGER)",
            default  => "HOUR(tickets.created_at)",
        };

        $hourRows = $base($from, $to)
            ->selectRaw("$hourExpr as hour_of_day, COUNT(*) as total")
            ->groupByRaw($hourExpr)
            ->orderByRaw($hourExpr)
            ->get();

        $maxH   = (int) ($hourRows->max('total') ?: 1);
        $byHour = $hourRows->map(fn ($r) => [
            'hour'  => (int) $r->hour_of_day,
            'total' => (int) $r->total,
            'peak'  => (int) $r->total >= (int) round($maxH * 0.8),
        ])->values()->toArray();

        // ── 6. Reportés ───────────────────────────────────────────────────────
        $defRow = $base($from, $to)->where('tickets.auto_deferred', true)->selectRaw("
            COUNT(*) as total,
            SUM(CASE WHEN tickets.defer_reason = 'past_cutoff'         THEN 1 ELSE 0 END) as r_past,
            SUM(CASE WHEN tickets.defer_reason = 'critical_zone'       THEN 1 ELSE 0 END) as r_critical,
            SUM(CASE WHEN tickets.defer_reason = 'non_working_day'     THEN 1 ELSE 0 END) as r_nwd,
            SUM(CASE WHEN tickets.defer_reason = 'holiday'             THEN 1 ELSE 0 END) as r_holiday,
            SUM(CASE WHEN tickets.defer_reason = 'exceptional_closure' THEN 1 ELSE 0 END) as r_exceptional
        ")->first();

        $dateExpr = $driver === 'pgsql' ? "tickets.valid_date::date" : "DATE(tickets.valid_date)";
        $upcomingRows = DB::table('tickets')
            ->join('services', 'services.id', '=', 'tickets.service_id')
            ->where('tickets.auto_deferred', true)
            ->where('tickets.status', 'waiting')
            ->whereDate('tickets.valid_date', '>=', now()->toDateString())
            ->whereDate('tickets.valid_date', '<=', now()->addDays(14)->toDateString())
            ->when(!empty($scopedId), fn ($q) => $q->where('services.establishment_id', (int) $scopedId))
            ->selectRaw("$dateExpr as vdate, COUNT(*) as total")
            ->groupByRaw($dateExpr)
            ->orderByRaw($dateExpr)
            ->get();

        $deferred = [
            'total'         => (int) ($defRow->total ?? 0),
            'by_reason'     => [
                ['reason' => 'past_cutoff',         'count' => (int) ($defRow->r_past ?? 0)],
                ['reason' => 'critical_zone',       'count' => (int) ($defRow->r_critical ?? 0)],
                ['reason' => 'non_working_day',     'count' => (int) ($defRow->r_nwd ?? 0)],
                ['reason' => 'holiday',             'count' => (int) ($defRow->r_holiday ?? 0)],
                ['reason' => 'exceptional_closure', 'count' => (int) ($defRow->r_exceptional ?? 0)],
            ],
            'upcoming_load' => $upcomingRows->map(fn ($r) => [
                'date' => (string) $r->vdate, 'count' => (int) $r->total,
            ])->values()->toArray(),
        ];

        return response()->json([
            'period'      => $period,
            'from'        => $from->toDateTimeString(),
            'to'          => $to->toDateTimeString(),
            'kpis'        => $kpis,
            'prev_kpis'   => $prevKpis,
            'by_service'  => $byService,
            'by_priority' => $byPriority,
            'by_source'   => $bySource,
            'by_hour'     => $byHour,
            'deferred'    => $deferred,
        ]);
    }

    /**
     * Séries temporelles (jour ou heure).
     * Query params:
     * - from/to (ISO ou Y-m-d)
     * - bucket = day|hour (default day)
     * - service_id (optionnel)
     */
    public function series(Request $request)
    {
        [$from, $to] = $this->parseRange($request, 14);
        $bucket = $request->query('bucket', 'day');
        $serviceId = $request->query('service_id') ? (int) $request->query('service_id') : null;

        $scopedId = $request->attributes->get('scoped_establishment_id');

        if (!in_array($bucket, ['day', 'hour'], true)) {
            abort(422, 'Invalid bucket');
        }

        $driver = DB::connection()->getDriverName();
        if ($driver === 'pgsql') {
            $expr = $bucket === 'hour'
                ? "to_char(date_trunc('hour', tickets.created_at), 'YYYY-MM-DD HH24:00:00')"
                : "to_char(date_trunc('day', tickets.created_at), 'YYYY-MM-DD')";
        } elseif ($driver === 'sqlite') {
            $expr = $bucket === 'hour'
                ? "strftime('%Y-%m-%d %H:00:00', tickets.created_at)"
                : "date(tickets.created_at)";
        } else {
            // mysql / mariadb
            $expr = $bucket === 'hour'
                ? "DATE_FORMAT(tickets.created_at, '%Y-%m-%d %H:00:00')"
                : "DATE(tickets.created_at)";
        }

        $query = DB::table('tickets')
            ->join('services', 'services.id', '=', 'tickets.service_id')
            ->selectRaw($expr." as bucket")
            ->selectRaw("COUNT(*) as created")
            ->selectRaw("SUM(CASE WHEN tickets.status='closed' THEN 1 ELSE 0 END) as closed")
            ->selectRaw("SUM(CASE WHEN tickets.status='absent' THEN 1 ELSE 0 END) as absent")
            ->whereBetween('tickets.created_at', [$from, $to]);

        // Filter by establishment scope
        if (!empty($scopedId)) {
            $query->where('services.establishment_id', (int) $scopedId);
        }

        if (!is_null($serviceId)) {
            $query->where('tickets.service_id', $serviceId);
        }

        $rows = $query
            ->groupBy('bucket')
            ->orderBy('bucket')
            ->get();

        $series = [];
        foreach ($rows as $r) {
            $series[] = [
                'bucket' => (string) $r->bucket,
                'created' => (int) ($r->created ?? 0),
                'closed' => (int) ($r->closed ?? 0),
                'absent' => (int) ($r->absent ?? 0),
            ];
        }

        return response()->json([
            'from' => $from->toDateTimeString(),
            'to' => $to->toDateTimeString(),
            'bucket' => $bucket,
            'service_id' => $serviceId,
            'series' => $series,
        ]);
    }
}
