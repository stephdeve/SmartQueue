<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('analytics_events', function (Blueprint $table) {
            // Identifiant de l'événement d'audit/analytics
            $table->id();
            // Référence optionnelle à l'utilisateur
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            // Référence optionnelle au service concerné
            $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
            // Type d'événement (ex: ticket_created, ticket_called, ticket_absent, ticket_closed)
            $table->string('event_type', 32);
            // Métadonnées JSON (numéro, priorité, etc.)
            $table->json('meta')->nullable();
            $table->timestamps();

            // Index analytiques
            $table->index(['service_id','event_type','created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('analytics_events');
    }
};
