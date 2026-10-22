<?php

namespace Tests\Feature;

use App\Models\Establishment;
use App\Models\Service;
use App\Models\Subscription;
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
 * Abonnements, suppression de compte, statistiques et suivi des agents.
 */
class ProductionReadinessTest extends TestCase
{
    use RefreshDatabase;

    private Establishment $establishment;
    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();
        Carbon::setTestNow(Carbon::parse('2026-10-20 10:00:00'));

        $this->establishment = Establishment::create(['name' => 'Mairie', 'lat' => 6.37, 'lng' => 2.39, 'is_active' => true]);
        $this->service = Service::create([
            'establishment_id' => $this->establishment->id,
            'name' => 'État civil',
            'status' => 'open',
            'avg_service_time_minutes' => 5,
            'opening_time' => '08:00:00',
            'closing_time' => '18:00:00',
        ]);
        app(ServiceAvailabilityService::class)->ensureWorkingDaysExist($this->service);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(string $role = 'user', ?Establishment $establishment = null): User
    {
        return User::factory()->create(['role' => $role, 'establishment_id' => $establishment?->id]);
    }

    public function test_plans_catalog_is_public(): void
    {
        $this->getJson('/api/plans')
            ->assertOk()
            ->assertJsonPath('currency', 'FCFA')
            ->assertJsonPath('plans.0.id', 'starter')
            ->assertJsonPath('plans.0.monthly_price', 10000);
    }

    public function test_subscription_request_opens_a_trial_and_cannot_self_declare_payment(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        $this->postJson('/api/onboarding/subscribe', ['plan' => 'gold', 'paid' => true])->assertStatus(422);

        $this->postJson('/api/onboarding/subscribe', ['plan' => 'professional', 'paid' => true])
            ->assertOk()
            ->assertJsonPath('pending_subscription.status', 'trial')
            ->assertJsonPath('next_step', 'create_establishment');

        $user->refresh();
        $this->assertSame('admin', $user->role);
        $this->assertArrayNotHasKey('paid_at', $user->pending_subscription);

        // La demande est rattachée à l'établissement créé ensuite
        $this->postJson('/api/admin/establishments', ['name' => 'Banque'])->assertCreated();
        $sub = Subscription::query()->firstOrFail();
        $this->assertSame('trial', $sub->status);
        $this->assertSame('professional', $sub->plan);
        $this->assertTrue($sub->current_period_end->equalTo(now()->addDays(30)));
    }

    public function test_trial_is_not_restarted_and_super_admin_activation_starts_the_paid_period(): void
    {
        $admin = $this->user('admin', $this->establishment);
        Sanctum::actingAs($admin);
        $this->postJson('/api/onboarding/subscribe', ['plan' => 'starter'])->assertOk()->assertJsonPath('subscription.status', 'trial');

        Carbon::setTestNow(now()->addDays(20));
        $this->postJson('/api/onboarding/subscribe', ['plan' => 'professional'])->assertOk();
        $sub = Subscription::query()->firstOrFail();
        $this->assertSame('professional', $sub->plan);
        $this->assertTrue($sub->current_period_end->equalTo(Carbon::parse('2026-10-20 10:00:00')->addDays(30)), "l'essai ne doit pas repartir de zéro");

        Sanctum::actingAs($this->user('super_admin'));
        $this->putJson("/api/saas/establishments/{$this->establishment->id}/subscription", ['plan' => 'professional', 'status' => 'active'])
            ->assertOk()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('monthly_amount', 30000);
        $this->assertTrue(Subscription::query()->firstOrFail()->current_period_end->equalTo(now()->addMonth()));

        Sanctum::actingAs($admin);
        $this->getJson('/api/admin/subscription')
            ->assertOk()
            ->assertJsonPath('subscription.status', 'active')
            ->assertJsonPath('subscription.plan_details.name', 'Professional');
    }

    public function test_user_can_delete_its_account_and_frees_its_queue_spot(): void
    {
        $user = $this->user();
        $ticket = app(TicketService::class)->createTicket($user, $this->service->id);
        Sanctum::actingAs($user);

        $this->deleteJson('/api/me', ['password' => 'wrong'])->assertStatus(422);
        $this->deleteJson('/api/me', ['password' => 'password'])->assertOk();

        $this->assertNull(User::find($user->id));
        $ticket->refresh();
        $this->assertSame('canceled', $ticket->status);
        $this->assertNull($ticket->user_id, "l'historique du ticket reste anonymisé");

        Sanctum::actingAs($this->user('agent', $this->establishment));
        $this->deleteJson('/api/me', ['password' => 'password'])->assertForbidden();
    }

    public function test_stats_count_definitive_absences_and_accept_utc_bounds(): void
    {
        config(['app.timezone' => 'Africa/Porto-Novo']);
        date_default_timezone_set('Africa/Porto-Novo');
        Carbon::setTestNow(Carbon::parse('2026-10-20 10:00:00', 'Africa/Porto-Novo'));

        $svc = app(TicketService::class);
        $absent = $svc->createTicket($this->user(), $this->service->id);
        $svc->callNext($this->service);
        $svc->markAbsent($absent->fresh());
        $svc->markAbsent($absent->fresh());
        $svc->permanentlyExpireAbsent($absent->fresh());
        $this->assertSame('expired', $absent->fresh()->status);

        Sanctum::actingAs($this->user('admin', $this->establishment));
        // 09:30Z = 10:30 au Bénin : le ticket créé à 10:00 (heure locale) doit être inclus
        $this->getJson('/api/admin/stats/overview?from=2026-10-20T00:00:00.000Z&to=2026-10-20T09:30:00.000Z')
            ->assertOk()
            ->assertJsonPath('tickets.created', 1)
            ->assertJsonPath('tickets.absent', 1);

        $this->getJson('/api/admin/stats/series?bucket=week&from=2026-10-01&to=2026-10-20')
            ->assertOk()
            ->assertJsonPath('series.0.bucket', '2026-10-19')
            ->assertJsonPath('series.0.absent', 1);

        date_default_timezone_set('UTC');
    }

    public function test_handled_tickets_and_activity_are_tracked_per_agent(): void
    {
        $agent = $this->user('agent', $this->establishment);
        $agent->services()->attach($this->service->id);
        $ticket = app(TicketService::class)->createTicket($this->user(), $this->service->id);

        $this->postJson('/api/auth/login', ['email' => $agent->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.establishment_id', $this->establishment->id);

        Sanctum::actingAs($agent);
        $this->postJson("/api/services/{$this->service->id}/call-next")->assertOk();
        $this->postJson("/api/tickets/{$ticket->id}/close")->assertOk();
        $this->assertSame($agent->id, (int) $ticket->fresh()->agent_id);

        $this->getJson('/api/agent/dashboard/performance?days=30')
            ->assertOk()
            ->assertJsonPath('days', 30)
            ->assertJsonPath('total_called', 1)
            ->assertJsonPath('total_closed', 1);

        Sanctum::actingAs($this->user('admin', $this->establishment));
        $response = $this->getJson('/api/admin/agents')->assertOk();
        $this->assertSame(1, $response->json('data.0.tickets_closed_30d'));
        $this->assertNotNull($response->json('data.0.last_login_at'));
    }

    public function test_agent_status_is_saved_and_deactivation_revokes_sessions(): void
    {
        $agent = $this->user('agent', $this->establishment);
        $agent->createToken('api');
        Sanctum::actingAs($this->user('admin', $this->establishment));

        $otherService = Service::create([
            'establishment_id' => Establishment::create(['name' => 'Autre', 'is_active' => true])->id,
            'name' => 'Caisse', 'status' => 'open',
        ]);
        $this->putJson("/api/admin/agents/{$agent->id}", ['status' => 'inactive', 'service_ids' => [$otherService->id]])->assertForbidden();
        $this->assertSame('active', $agent->fresh()->status ?? 'active', 'aucune écriture partielle avant le contrôle de cloisonnement');

        $this->putJson("/api/admin/agents/{$agent->id}", ['status' => 'inactive'])->assertOk();
        $this->assertSame('inactive', $agent->fresh()->status);
        $this->assertSame(0, $agent->tokens()->count());

        $this->postJson('/api/admin/agents', ['name' => 'Nouvel agent', 'email' => 'new@example.com', 'status' => 'pending'])
            ->assertOk()
            ->assertJsonPath('status', 'pending');
    }

    public function test_super_admin_overview_and_configuration_diagnostics(): void
    {
        app(TicketService::class)->createTicket($this->user(), $this->service->id);
        Subscription::create(['establishment_id' => $this->establishment->id, 'plan' => 'pro', 'status' => 'active']);

        Sanctum::actingAs($this->user('super_admin'));
        $this->getJson('/api/saas/monitoring/overview?days=7')
            ->assertOk()
            ->assertJsonPath('tickets.total', 1)
            ->assertJsonPath('tickets.waiting', 1)
            ->assertJsonPath('mrr_estimate', 30000)
            ->assertJsonPath('subscriptions_by_plan.professional', 1)
            ->assertJsonCount(7, 'timeline');

        $this->getJson('/api/saas/establishments')
            ->assertOk()
            ->assertJsonPath('data.0.total_tickets', 1)
            ->assertJsonPath('data.0.subscription.plan', 'professional');

        $checks = collect($this->getJson('/api/saas/admin/config')->assertOk()->json('checks'))->keyBy('key');
        $this->assertSame('error', $checks['mail']['level'], 'MAIL_MAILER=log ne doit pas passer pour configuré');
        $this->assertArrayNotHasKey('secret', $checks->first());
    }
}
