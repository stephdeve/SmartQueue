<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Establishment;

class EstablishmentSeeder extends Seeder
{
    public function run(): void
    {
        $data = [
            ['name' => 'Hôpital Central', 'address' => '10 Rue de la Santé, Paris', 'lat' => 48.8566, 'lng' => 2.3522, 'open_at' => '08:00:00', 'close_at' => '18:00:00', 'is_active' => true],
            ['name' => 'Mairie Ville', 'address' => '1 Place de la Mairie, Lyon', 'lat' => 45.7640, 'lng' => 4.8357, 'open_at' => '09:00:00', 'close_at' => '17:00:00', 'is_active' => true],
            ['name' => 'Préfecture', 'address' => '2 Avenue de la République, Marseille', 'lat' => 43.2965, 'lng' => 5.3698, 'open_at' => '08:30:00', 'close_at' => '16:30:00', 'is_active' => true],
            ['name' => 'Centre Social', 'address' => '5 Allée des Tilleuls, Toulouse', 'lat' => 43.6047, 'lng' => 1.4442, 'open_at' => '09:00:00', 'close_at' => '18:00:00', 'is_active' => true],
            ['name' => 'Clinique du Parc', 'address' => '7 Boulevard du Parc, Nantes', 'lat' => 47.2184, 'lng' => -1.5536, 'open_at' => '07:30:00', 'close_at' => '19:30:00', 'is_active' => true],
        ];
        foreach ($data as $row) {
            Establishment::firstOrCreate(['name' => $row['name']], $row);
        }
    }
}
