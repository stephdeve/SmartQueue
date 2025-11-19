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
        Schema::create('tickets', function (Blueprint $table) {
            // Identifiant
            $table->id();
            // Relation utilisateur (peut être nul si ticket anonyme)
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            // Relation service (obligatoire)
            $table->foreignId('service_id')->constrained('services')->cascadeOnDelete();
            // Numéro lisible par l'humain (ex: A-042)
            $table->string('number', 16);
            // Statut du ticket (machine d'états)
            $table->enum('status', ['waiting','called','absent','closed','canceled']);
            // Priorité d'accès
            $table->enum('priority', ['normal','high','vip'])->default('normal');
            // Position courante estimée dans la file (optionnelle)
            $table->integer('position')->nullable();
            // Timestamps métiers
            $table->timestamp('called_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('absent_at')->nullable();
            // Données de dernière localisation connue (pour l'algorithme)
            $table->integer('last_distance_m')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            // Audit
            $table->timestamps();

            // Index pour performances
            $table->index(['service_id','status']);
            $table->index(['service_id','priority','created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
