<?php

/*
|--------------------------------------------------------------------------
| Offres d'abonnement
|--------------------------------------------------------------------------
| Source unique des offres affichées par le web (page d'accueil, abonnement,
| paramètres) et utilisées par le back-office SaaS (revenu mensuel estimé).
| Les prix sont mensuels, en FCFA. Une limite à null signifie « illimité ».
|
| Les limites sont affichées aux clients mais ne sont pas bloquantes côté API.
*/

return [
    'currency' => 'FCFA',

    // Remise appliquée au paiement annuel (prix mensuel × 12 × (1 - remise))
    'annual_discount_percent' => 20,

    // Durée de la période d'essai ouverte à la souscription en ligne : l'abonnement
    // passe en « actif » quand l'équipe SmartQueue valide le règlement.
    'trial_days' => (int) env('SUBSCRIPTION_TRIAL_DAYS', 30),

    'plans' => [
        'starter' => [
            'name' => 'Starter',
            'monthly_price' => 10000,
            'description' => 'Parfait pour les petites structures',
            'popular' => false,
            'limits' => ['agents' => 2, 'services' => 3, 'tickets_per_day' => 50],
            'features' => [
                "Jusqu'à 50 tickets par jour",
                '2 agents',
                '3 services',
                'Notifications push',
                'Statistiques de base',
                'Support e-mail 5j/7',
            ],
        ],
        'professional' => [
            'name' => 'Professional',
            'monthly_price' => 30000,
            'description' => 'Idéal pour les structures en croissance',
            'popular' => true,
            'limits' => ['agents' => 5, 'services' => null, 'tickets_per_day' => 200],
            'features' => [
                "Jusqu'à 200 tickets par jour",
                '5 agents',
                'Services illimités',
                'Notifications push et SMS',
                'Statistiques avancées',
                'Export des données (CSV)',
                'Support prioritaire 7j/7',
            ],
        ],
        'enterprise' => [
            'name' => 'Enterprise',
            'monthly_price' => 80000,
            'description' => 'Pour les grandes organisations',
            'popular' => false,
            'limits' => ['agents' => null, 'services' => null, 'tickets_per_day' => null],
            'features' => [
                'Tickets illimités',
                'Agents illimités',
                'Services illimités',
                'Notifications push et SMS',
                'Statistiques avancées et export',
                'Formation incluse',
                'Interlocuteur dédié',
            ],
        ],
    ],

    // Anciens identifiants encore présents en base (souscriptions antérieures)
    'aliases' => [
        'basic' => 'starter',
        'pro' => 'professional',
        'free' => 'starter',
    ],
];
