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
        Schema::create('notification_logs', function (Blueprint $table) {
            // Identifiant du log
            $table->id();
            // Ticket concerné (cascade on delete)
            $table->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
            // Canal d'envoi: push ou sms
            $table->enum('channel', ['push','sms']);
            // Type fonctionnel de la notification
            $table->string('type', 32); // approaching, called, absent
            // Statut d'envoi
            $table->enum('status', ['queued','sent','failed']);
            // Payload envoyé (audit)
            $table->json('payload')->nullable();
            // Date d'envoi effectif
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            // Index utiles
            $table->index(['ticket_id']);
            $table->index(['channel']);
            $table->index(['type']);
            $table->index(['status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notification_logs');
    }
};
