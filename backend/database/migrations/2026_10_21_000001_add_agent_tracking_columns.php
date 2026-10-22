<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Suivi de l'activité des agents :
 * - tickets.agent_id : agent (ou admin) qui a appelé / clôturé le ticket ;
 * - users.last_login_at : dernière connexion (affichée dans la gestion des agents).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            if (!Schema::hasColumn('tickets', 'agent_id')) {
                $table->foreignId('agent_id')->nullable()->after('counter_id')
                    ->constrained('users')->nullOnDelete();
                $table->index(['agent_id', 'closed_at']);
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            if (Schema::hasColumn('tickets', 'agent_id')) {
                $table->dropIndex(['agent_id', 'closed_at']);
                $table->dropConstrainedForeignId('agent_id');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'last_login_at')) {
                $table->dropColumn('last_login_at');
            }
        });
    }
};
