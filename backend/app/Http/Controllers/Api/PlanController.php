<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SubscriptionService;

class PlanController extends Controller
{
    /** Catalogue public des offres (page d'accueil, abonnement, paramètres). */
    public function index()
    {
        return response()->json(SubscriptionService::catalog());
    }
}
