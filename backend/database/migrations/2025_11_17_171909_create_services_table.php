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
        Schema::create('services', function (Blueprint $table) {
            // Identifiant et rattachement à l'établissement
            $table->id();
            $table->foreignId('establishment_id')->constrained('establishments')->cascadeOnDelete();
            // Libellé du service (ex: Consultation, Labo)
            $table->string('name', 160);
            // Temps moyen de service (minutes) utilisé pour ETA
            $table->unsignedInteger('avg_service_time_minutes')->default(5);
            // Statut de la file (ouverte/fermée)
            $table->enum('status', ['open','closed'])->default('open');
            // Support des priorités (affecte l'algorithme d'appel)
            $table->boolean('priority_support')->default(true);
            $table->timestamps();

            // Index de jointure et de filtre
            $table->index(['establishment_id']);
            $table->index(['status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
