<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Sous SQLite (développement local, tests), les colonnes enum de la migration initiale
     * sont des CHECK figés : les statuts en_route/present et la priorité urgence, ajoutés
     * plus tard pour MySQL/PostgreSQL uniquement, y étaient refusés.
     * Les autres moteurs sont déjà à jour (migrations 2026_06_02_140000 et 2026_06_10_200001).
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        Schema::table('tickets', function (Blueprint $table) {
            $table->string('status', 16)->change();
            $table->string('priority', 16)->default('normal')->change();
        });
    }

    public function down(): void
    {
        // Pas de retour aux CHECK restrictifs : ils rejetteraient les données existantes.
    }
};
