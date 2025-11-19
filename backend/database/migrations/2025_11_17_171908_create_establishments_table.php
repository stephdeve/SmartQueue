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
        Schema::create('establishments', function (Blueprint $table) {
            // Identifiant primaire
            $table->id();
            // Nom et adresse de l'établissement
            $table->string('name', 160);
            $table->text('address')->nullable();
            // Coordonnées géographiques (décimales pour compatibilité SQLite/MySQL). PostGIS pourra remplacer ceci en prod.
            $table->decimal('lat', 10, 7)->nullable(); // latitude [-90,90]
            $table->decimal('lng', 10, 7)->nullable(); // longitude [-180,180]
            // Horaires d'ouverture (indicatifs)
            $table->time('open_at')->nullable();
            $table->time('close_at')->nullable();
            // Activation (permet de masquer/fermer globalement un établissement)
            $table->boolean('is_active')->default(true);
            // Timestamps de création/mise à jour
            $table->timestamps();

            // Index utiles
            $table->index(['is_active']);
            // Index de recherche géo basique (lat, lng) — non spatial
            $table->index(['lat', 'lng']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('establishments');
    }
};
