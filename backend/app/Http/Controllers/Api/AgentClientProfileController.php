<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AgentClientProfileController extends Controller
{
    /**
     * Retourne le profil client associé à un ticket :
     * nom, téléphone, nombre de visites, historique absences,
     * temps moyen de service, et tickets précédents.
     */
    public function show(Ticket $ticket): JsonResponse
    {
        $this->authorize('manage', $ticket->service);

        $customerName = $ticket->customer_name;
        $customerPhone = $ticket->customer_phone;
        $userId = $ticket->user_id;

        // Trouver tous les tickets du même client, limités à l'établissement du ticket :
        // un nom/téléphone identique ailleurs ne doit pas exposer l'historique d'un tiers.
        $establishmentServiceIds = \App\Models\Service::query()
            ->where('establishment_id', $ticket->service->establishment_id)
            ->pluck('id');

        $query = Ticket::whereIn('service_id', $establishmentServiceIds)->where(function ($q) use ($customerName, $customerPhone, $userId) {
            if ($userId) {
                $q->where('user_id', $userId);
            }
            if ($customerName) {
                $q->orWhere('customer_name', $customerName);
            }
            if ($customerPhone) {
                $q->orWhere('customer_phone', $customerPhone);
            }
            // Fallback: si aucun critère, retourne juste le ticket courant
            if (!$userId && !$customerName && !$customerPhone) {
                $q->where('id', $ticket->id);
            }
        });

        $allTickets = (clone $query)
            ->with(['service:id,name', 'counter:id,name'])
            ->orderBy('created_at', 'desc')
            ->get();

        $totalVisits = $allTickets->count();
        $absentCount = $allTickets->where('status', 'absent')->count();

        // Temps moyen de service (closed_at - called_at) en secondes
        $driver = DB::connection()->getDriverName();
        $diffExpr = match ($driver) {
            'pgsql'  => "EXTRACT(EPOCH FROM (closed_at - called_at))",
            'sqlite' => "CAST(strftime('%s', closed_at) - strftime('%s', called_at) AS REAL)",
            default  => "TIMESTAMPDIFF(SECOND, called_at, closed_at)",
        };
        $avgServiceSeconds = (clone $query)
            ->whereNotNull('called_at')
            ->whereNotNull('closed_at')
            ->selectRaw("AVG($diffExpr) as avg_seconds")
            ->value('avg_seconds');

        $recentTickets = $allTickets->take(10)->map(fn(Ticket $t) => [
            'id'             => $t->id,
            'number'         => $t->number,
            'status'         => $t->status,
            'priority'       => $t->priority,
            'service_name'   => $t->service?->name,
            'counter_name'   => $t->counter?->name,
            'called_at'      => $t->called_at?->toDateTimeString(),
            'closed_at'      => $t->closed_at?->toDateTimeString(),
            'absent_level'   => (int) ($t->absent_level ?? 0),
            'created_at'     => $t->created_at->toDateTimeString(),
        ]);

        return response()->json([
            'customer_name'        => $customerName,
            'customer_phone'       => $customerPhone,
            'user_id'              => $userId,
            'total_visits'         => $totalVisits,
            'absent_count'         => $absentCount,
            'avg_service_seconds'  => $avgServiceSeconds ? (int) round($avgServiceSeconds) : null,
            'recent_tickets'       => $recentTickets,
        ]);
    }
}
