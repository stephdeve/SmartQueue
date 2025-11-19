<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Handle an incoming request.
     *
     * Vérifie que l'utilisateur authentifié possède l'un des rôles requis.
     * Utilisation: ->middleware('role:agent,admin')
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string $rolesCsv = ''): Response
    {
        // Récupère l'utilisateur courant (via Sanctum) et la liste des rôles requis
        $user = $request->user();
        $allowedRoles = array_filter(array_map('trim', explode(',', $rolesCsv)));

        // Si aucun utilisateur ou aucun rôle n'est fourni, on refuse l'accès
        if (!$user || empty($allowedRoles)) {
            abort(403, 'Forbidden');
        }

        // Autorise si le rôle de l'utilisateur correspond à l'une des valeurs attendues
        if (!in_array($user->role, $allowedRoles, true)) {
            abort(403, 'Insufficient role');
        }

        return $next($request);
    }
}
