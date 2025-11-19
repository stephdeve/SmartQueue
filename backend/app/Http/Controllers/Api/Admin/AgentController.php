<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Service;

class AgentController extends Controller
{
    /** Liste les agents avec leurs services assignés. */
    public function index()
    {
        $agents = User::query()
            ->where('role', 'agent')
            ->with('services')
            ->orderBy('name')
            ->paginate(50);
        return response()->json($agents);
    }

    /** Crée un agent et assigne des services. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required','string','max:120'],
            'email' => ['required','email','unique:users,email'],
            'password' => ['required','string','min:8'],
            'phone' => ['nullable','string','max:32','unique:users,phone'],
            'service_ids' => ['array'],
            'service_ids.*' => ['integer','exists:services,id'],
        ]);

        $agent = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => bcrypt($data['password']),
            'phone' => $data['phone'] ?? null,
            'role' => 'agent',
        ]);

        if (!empty($data['service_ids'])) {
            $agent->services()->sync($data['service_ids']);
        }

        return response()->json($agent->load('services'));
    }

    /** Affiche un agent. */
    public function show(int $id)
    {
        $agent = User::where('role', 'agent')->with('services')->findOrFail($id);
        return response()->json($agent);
    }

    /** Met à jour un agent (données et affectations). */
    public function update(Request $request, int $id)
    {
        $agent = User::where('role', 'agent')->findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes','string','max:120'],
            'email' => ['sometimes','email','unique:users,email,'.$agent->id],
            'password' => ['sometimes','string','min:8'],
            'phone' => ['sometimes','nullable','string','max:32','unique:users,phone,'.$agent->id],
            'service_ids' => ['sometimes','array'],
            'service_ids.*' => ['integer','exists:services,id'],
        ]);
        if (isset($data['password'])) {
            $data['password'] = bcrypt($data['password']);
        }
        $agent->update($data);
        if (array_key_exists('service_ids', $data)) {
            $agent->services()->sync($data['service_ids'] ?? []);
        }
        return response()->json($agent->load('services'));
    }

    /** Supprime un agent. */
    public function destroy(int $id)
    {
        $agent = User::where('role', 'agent')->findOrFail($id);
        $agent->services()->detach();
        $agent->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
