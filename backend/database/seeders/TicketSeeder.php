<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use App\Models\Ticket;
use App\Models\Service;
use App\Models\User;

class TicketSeeder extends Seeder
{
    public function run(): void
    {
        $services = Service::all();
        if ($services->isEmpty()) return;

        $userIds = User::pluck('id')->all();
        $now = Carbon::now();

        foreach ($services as $service) {
            // Waiting tickets
            for ($i = 1; $i <= 20; $i++) {
                Ticket::create([
                    'user_id' => $userIds ? $userIds[array_rand($userIds)] : null,
                    'service_id' => $service->id,
                    'number' => sprintf('W-%02d-%03d', $service->id, $i),
                    'status' => 'waiting',
                    'priority' => rand(0, 9) < 2 ? 'high' : 'normal',
                    'position' => $i,
                    'created_at' => $now->copy()->subMinutes(rand(5, 180)),
                    'updated_at' => $now,
                ]);
            }

            // Called tickets
            for ($i = 1; $i <= 10; $i++) {
                $created = $now->copy()->subMinutes(rand(30, 240));
                $called = (clone $created)->addMinutes(rand(1, 30));
                Ticket::create([
                    'user_id' => $userIds ? $userIds[array_rand($userIds)] : null,
                    'service_id' => $service->id,
                    'number' => sprintf('C-%02d-%03d', $service->id, $i),
                    'status' => 'called',
                    'priority' => rand(0, 9) < 2 ? 'vip' : 'normal',
                    'position' => null,
                    'created_at' => $created,
                    'called_at' => $called,
                    'last_seen_at' => $called->copy()->addMinutes(rand(0, 10)),
                    'updated_at' => $now,
                ]);
            }

            // Absent tickets
            for ($i = 1; $i <= 10; $i++) {
                $created = $now->copy()->subMinutes(rand(60, 360));
                $absent = (clone $created)->addMinutes(rand(5, 60));
                Ticket::create([
                    'user_id' => $userIds ? $userIds[array_rand($userIds)] : null,
                    'service_id' => $service->id,
                    'number' => sprintf('A-%02d-%03d', $service->id, $i),
                    'status' => 'absent',
                    'priority' => 'normal',
                    'position' => null,
                    'created_at' => $created,
                    'absent_at' => $absent,
                    'updated_at' => $now,
                ]);
            }

            // Closed tickets
            for ($i = 1; $i <= 20; $i++) {
                $created = $now->copy()->subDays(rand(0, 6))->subMinutes(rand(0, 600));
                $called = (clone $created)->addMinutes(rand(1, 30));
                $closed = (clone $called)->addMinutes(rand(1, 45));
                Ticket::create([
                    'user_id' => $userIds ? $userIds[array_rand($userIds)] : null,
                    'service_id' => $service->id,
                    'number' => sprintf('D-%02d-%03d', $service->id, $i),
                    'status' => 'closed',
                    'priority' => rand(0, 9) < 1 ? 'vip' : 'normal',
                    'position' => null,
                    'created_at' => $created,
                    'called_at' => $called,
                    'closed_at' => $closed,
                    'updated_at' => $now,
                ]);
            }

            // Canceled tickets
            for ($i = 1; $i <= 5; $i++) {
                $created = $now->copy()->subMinutes(rand(10, 300));
                Ticket::create([
                    'user_id' => $userIds ? $userIds[array_rand($userIds)] : null,
                    'service_id' => $service->id,
                    'number' => sprintf('X-%02d-%03d', $service->id, $i),
                    'status' => 'canceled',
                    'priority' => 'normal',
                    'position' => null,
                    'created_at' => $created,
                    'updated_at' => $now,
                ]);
            }
        }
    }
}
