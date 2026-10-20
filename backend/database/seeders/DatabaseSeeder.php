<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Super admin : identifiants fournis par l'environnement (ignoré s'ils sont absents)
        $this->call(SuperAdminSeeder::class);

        // Données de démonstration (comptes au mot de passe connu, faux tickets) :
        // jamais en production.
        if (app()->environment('production')) {
            return;
        }

        $this->call([
            AdminSeeder::class,
            EstablishmentSeeder::class,
            ServiceSeeder::class,
            AgentSeeder::class,
            UserSeeder::class,
            TicketSeeder::class,
        ]);
    }
}

