<?php

namespace App\Policies;

use App\Models\Service;
use App\Models\User;

class ServicePolicy
{
    // Gestion d'un service (actions agent: call-next, close, etc.)
    public function manage(User $user, Service $service): bool
    {
        // Les admins peuvent gérer tous les services de leur établissement
        if ($user->role === 'admin') {
            return $user->establishment_id !== null
                && (int) $user->establishment_id === (int) $service->establishment_id;
        }

        // Les agents peuvent gérer uniquement les services qui leur sont assignés
        if ($user->role === 'agent') {
            return $user->services()->where('services.id', $service->id)->exists();
        }

        return false;
    }
}
