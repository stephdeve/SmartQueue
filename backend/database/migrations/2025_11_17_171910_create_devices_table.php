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
        Schema::create('devices', function (Blueprint $table) {
            // Identifiant du device (application installée)
            $table->id();
            // Propriétaire du device (utilisateur connecté)
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // Token FCM (potentiellement long)
            $table->text('fcm_token');
            // Plateforme cible (android, ios, web)
            $table->string('platform', 16)->nullable();
            // Version de l'application (diagnostic)
            $table->string('app_version', 32)->nullable();
            // Préférences de notifications
            $table->boolean('push_enabled')->default(true);
            $table->boolean('sms_enabled')->default(false);
            $table->timestamps();

            // Index et contraintes
            $table->index(['user_id']);
            $table->index(['platform']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};
