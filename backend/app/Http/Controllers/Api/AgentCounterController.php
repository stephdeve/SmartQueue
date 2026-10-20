<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Counter;
use Illuminate\Http\Request;

class AgentCounterController extends Controller
{
    public function open(Counter $counter, Request $request)
    {
        if (!in_array($request->user()->role, ['agent','admin'], true)) {
            abort(403, 'Forbidden');
        }
        $this->assertSameEstablishment($counter, $request);

        // Un agent ne peut pas prendre un guichet déjà tenu par un collègue
        if ($counter->status === 'open'
            && $counter->current_agent_id !== null
            && (int) $counter->current_agent_id !== (int) $request->user()->id
            && $request->user()->role === 'agent') {
            abort(409, 'Counter already opened by another agent');
        }

        $counter->status = 'open';
        $counter->opened_at = now();
        $counter->closed_at = null;
        $counter->current_agent_id = $request->user()->id;
        $counter->save();

        return response()->json(['counter' => [
            'id' => $counter->id,
            'status' => $counter->status,
            'current_agent_id' => $counter->current_agent_id,
        ]]);
    }

    public function close(Counter $counter, Request $request)
    {
        if (!in_array($request->user()->role, ['agent','admin'], true)) {
            abort(403, 'Forbidden');
        }
        $this->assertSameEstablishment($counter, $request);

        if ($request->user()->role === 'agent' && (int) $counter->current_agent_id !== (int) $request->user()->id) {
            abort(403, 'You are not assigned to this counter');
        }

        $counter->status = 'closed';
        $counter->closed_at = now();
        $counter->current_agent_id = null;
        $counter->save();

        return response()->json(['counter' => [
            'id' => $counter->id,
            'status' => $counter->status,
        ]]);
    }

    /** Un guichet n'est manipulable que par le personnel de son établissement. */
    private function assertSameEstablishment(Counter $counter, Request $request): void
    {
        $establishmentId = $request->user()->establishment_id;
        if ($establishmentId === null || (int) $counter->establishment_id !== (int) $establishmentId) {
            abort(403, 'Forbidden establishment scope');
        }
    }
}
