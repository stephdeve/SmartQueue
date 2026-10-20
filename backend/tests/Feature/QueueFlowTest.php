<?php

namespace Tests\Feature;

use App\Models\Establishment;
use App\Models\Service;
use App\Models\Ticket;
use App\Models\User;
use App\Services\ServiceAvailabilityService;
use App\Services\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Bus;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Régressions sur le cycle de vie d'un ticket et le cloisonnement par établissement.
 */
class QueueFlowTest extends TestCase
{
    use RefreshDatabase;

    private Establishment $establishment;
    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();

        // Les notifications push/SMS ne doivent pas partir pendant les tests
        Bus::fake();
        Carbon::setTestNow(Carbon::parse('2026-10-20 10:00:00'));

        $this->establishment = Establishment::create([
            'name' => 'Mairie', 'lat' => 6.37, 'lng' => 2.39, 'is_active' => true,
        ]);
        $this->service = $this->makeService($this->establishment, 'État civil');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeService(Establishment $establishment, string $name): Service
    {
        $service = Service::create([
            'establishment_id' => $establishment->id,
            'name' => $name,
            'status' => 'open',
            'avg_service_time_minutes' => 5,
            'opening_time' => '08:00:00',
            'closing_time' => '18:00:00',
        ]);
        app(ServiceAvailabilityService::class)->ensureWorkingDaysExist($service);

        return $service;
    }

    private function user(string $role = 'user', ?Establishment $establishment = null): User
    {
        return User::factory()->create([
            'role' => $role,
            'establishment_id' => $establishment?->id,
        ]);
    }

    private function waitingTicket(User $user, Service $service): Ticket
    {
        return app(TicketService::class)->createTicket($user, $service->id);
    }

    public function test_ticket_numbers_use_an_ascii_prefix_and_increment(): void
    {
        $first = $this->waitingTicket($this->user(), $this->service);
        $second = $this->waitingTicket($this->user(), $this->service);

        $this->assertSame('E-001-20261020', $first->number);
        $this->assertSame('E-002-20261020', $second->number);

        // Préfixe non alphabétique : la séquence doit quand même progresser
        $numbered = $this->makeService($this->establishment, '123');
        $this->assertSame('T-001-20261020', $this->waitingTicket($this->user(), $numbered)->number);
        $this->assertSame('T-002-20261020', $this->waitingTicket($this->user(), $numbered)->number);
    }

    public function test_admin_can_use_agent_routes_of_its_own_establishment_only(): void
    {
        $this->waitingTicket($this->user(), $this->service);

        Sanctum::actingAs($this->user('admin', $this->establishment));
        $this->postJson("/api/services/{$this->service->id}/call-next")
            ->assertOk()
            ->assertJsonPath('called_ticket.status', 'called');

        $otherEstablishment = Establishment::create(['name' => 'Banque', 'is_active' => true]);
        Sanctum::actingAs($this->user('admin', $otherEstablishment));
        $this->postJson("/api/services/{$this->service->id}/call-next")->assertForbidden();
    }

    public function test_agent_cannot_act_on_tickets_of_an_unassigned_service(): void
    {
        $ticket = $this->waitingTicket($this->user(), $this->service);

        Sanctum::actingAs($this->user('agent', $this->establishment));
        $this->postJson("/api/tickets/{$ticket->id}/close")->assertForbidden();
        $this->postJson("/api/tickets/{$ticket->id}/cancel")->assertForbidden();
    }

    public function test_call_next_never_calls_the_same_ticket_twice(): void
    {
        $first = $this->waitingTicket($this->user(), $this->service);
        $second = $this->waitingTicket($this->user(), $this->service);

        $agent = $this->user('agent', $this->establishment);
        $agent->services()->attach($this->service->id);
        Sanctum::actingAs($agent);

        $this->postJson("/api/services/{$this->service->id}/call-next")
            ->assertJsonPath('called_ticket.id', $first->id);
        $this->postJson("/api/services/{$this->service->id}/call-next")
            ->assertJsonPath('called_ticket.id', $second->id);
        $this->postJson("/api/services/{$this->service->id}/call-next")->assertNoContent();
    }

    public function test_agent_defer_route_is_not_shadowed_by_the_user_route(): void
    {
        $owner = $this->user();
        $ticket = $this->waitingTicket($owner, $this->service);
        $next = $this->waitingTicket($this->user(), $this->service);
        app(TicketService::class)->callNext($this->service);

        $agent = $this->user('agent', $this->establishment);
        $agent->services()->attach($this->service->id);
        Sanctum::actingAs($agent);

        $this->postJson("/api/tickets/{$ticket->id}/defer")
            ->assertOk()
            ->assertJsonPath('ticket.status', 'waiting');

        $next->refresh();
        $this->assertSame('called', $next->status);
        $this->assertNotNull($next->called_expires_at, 'le ticket appelé à la place doit expirer');
    }

    public function test_definitive_absence_is_expired_not_counted_as_served(): void
    {
        $ticket = $this->waitingTicket($this->user(), $this->service);
        $svc = app(TicketService::class);

        $svc->callNext($this->service);
        $svc->markAbsent($ticket->fresh());
        $svc->markAbsent($ticket->fresh()); // max_call_attempts = 2 → définitif

        $this->assertNotNull($ticket->fresh()->absent_expires_at);

        Carbon::setTestNow(now()->addMinutes(30));
        $this->artisan('tickets:expire-called')->assertSuccessful();

        $this->assertSame('expired', $ticket->fresh()->status);
    }

    public function test_average_service_time_is_positive(): void
    {
        $user = $this->user();
        for ($i = 0; $i < 10; $i++) {
            Ticket::create([
                'user_id' => $user->id,
                'service_id' => $this->service->id,
                'number' => sprintf('X-%03d-20261020', $i),
                'status' => 'closed',
                'priority' => 'normal',
                'valid_date' => '2026-10-20',
                'called_at' => now()->subMinutes(60),
                'closed_at' => now()->subMinutes(40),
            ]);
        }

        $first = $this->waitingTicket($this->user(), $this->service);
        $second = $this->waitingTicket($this->user(), $this->service);

        $this->assertSame(0, (int) $first->fresh()->eta_minutes);
        $this->assertSame(20, (int) $second->fresh()->eta_minutes);
    }

    public function test_deferred_tickets_are_listed_as_active(): void
    {
        $user = $this->user();
        Carbon::setTestNow(Carbon::parse('2026-10-20 19:00:00')); // après la fermeture

        $ticket = $this->waitingTicket($user, $this->service);
        $this->assertTrue((bool) $ticket->auto_deferred);

        Sanctum::actingAs($user);
        $this->getJson('/api/tickets/active')
            ->assertOk()
            ->assertJsonPath('data.0.id', $ticket->id)
            ->assertJsonPath('data.0.auto_deferred', true);
    }

    public function test_presence_channel_is_authorized_for_service_staff_only(): void
    {
        config([
            'broadcasting.default' => 'pusher',
            'broadcasting.connections.pusher.key' => 'key',
            'broadcasting.connections.pusher.secret' => 'secret',
            'broadcasting.connections.pusher.app_id' => 'app',
        ]);
        // Les canaux sont enregistrés au démarrage sur le driver par défaut ("null" en test)
        require base_path('routes/channels.php');

        $payload = ['channel_name' => "presence-service.{$this->service->id}", 'socket_id' => '1234.5678'];

        $agent = $this->user('agent', $this->establishment);
        $agent->services()->attach($this->service->id);
        Sanctum::actingAs($agent);
        $this->postJson('/api/broadcasting/auth', $payload)->assertOk()->assertJsonStructure(['auth', 'channel_data']);

        Sanctum::actingAs($this->user());
        $this->postJson('/api/broadcasting/auth', $payload)->assertForbidden();
    }

    public function test_calling_a_waiting_ticket_directly_renumbers_the_queue(): void
    {
        $first = $this->waitingTicket($this->user(), $this->service);
        $second = $this->waitingTicket($this->user(), $this->service);

        app(TicketService::class)->recall($first);

        $this->assertSame('called', $first->fresh()->status);
        $this->assertSame(1, (int) $second->fresh()->position);
    }

    public function test_admin_service_payload_keeps_capacity_and_priority_support(): void
    {
        $this->service->update(['capacity' => 40, 'priority_support' => false]);

        Sanctum::actingAs($this->user('admin', $this->establishment));
        $this->getJson("/api/admin/services/{$this->service->id}")
            ->assertOk()
            ->assertJsonPath('data.capacity', 40)
            ->assertJsonPath('data.priority_support', false);
    }

    public function test_login_is_rate_limited_per_account(): void
    {
        $user = $this->user();

        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertUnauthorized();
        }
        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertStatus(429);

        // Un autre compte depuis la même IP n'est pas bloqué
        $other = $this->user();
        $this->postJson('/api/auth/login', ['email' => $other->email, 'password' => 'password'])->assertOk();
    }

    public function test_nearby_establishments_query_succeeds(): void
    {
        $this->waitingTicket($this->user(), $this->service);

        $this->getJson('/api/establishments?lat=6.37&lng=2.39&radius=5000')
            ->assertOk()
            ->assertJsonPath('data.0.id', $this->establishment->id)
            ->assertJsonPath('data.0.people_waiting', 1);
    }
}
