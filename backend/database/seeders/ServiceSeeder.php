<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Establishment;
use App\Models\Service;

class ServiceSeeder extends Seeder
{
    public function run(): void
    {
        $ests = Establishment::all();
        foreach ($ests as $est) {
            Service::firstOrCreate(
                ['establishment_id' => $est->id, 'name' => 'Accueil'],
                ['avg_service_time_minutes' => 5, 'status' => 'open', 'priority_support' => true]
            );
            Service::firstOrCreate(
                ['establishment_id' => $est->id, 'name' => 'Consultation'],
                ['avg_service_time_minutes' => 10, 'status' => 'open', 'priority_support' => true]
            );
        }
    }
}
