<?php

namespace App\Policies;

use App\Models\Service;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ServicePolicy
{
    // Gestion d'un service (actions agent: call-next, close, etc.)
    public function manage(User $user, Service $service): bool
    {
        return in_array($user->role, ['agent','admin'], true);
    }
}

