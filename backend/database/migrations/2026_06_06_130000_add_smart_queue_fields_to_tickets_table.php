<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // Flag set by SmartQueueEngine when a ticket is auto-deferred to a future day.
            $table->boolean('auto_deferred')->default(false);
            // Reason code: critical_zone | past_cutoff | non_working_day | holiday |
            //              exceptional_closure | temporarily_unavailable
            $table->string('defer_reason', 32)->nullable();

            // Helpful index for the deferred-queue lookup (per service, per target day)
            $table->index(['service_id', 'valid_date', 'auto_deferred'], 'tickets_service_validdate_deferred_idx');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex('tickets_service_validdate_deferred_idx');
            $table->dropColumn(['auto_deferred', 'defer_reason']);
        });
    }
};
