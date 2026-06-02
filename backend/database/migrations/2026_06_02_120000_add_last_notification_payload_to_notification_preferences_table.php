<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notification_preferences', function (Blueprint $table) {
            if (!Schema::hasColumn('notification_preferences', 'last_notification_payload')) {
                $table->string('last_notification_payload')->nullable()->after('last_notified_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('notification_preferences', function (Blueprint $table) {
            if (Schema::hasColumn('notification_preferences', 'last_notification_payload')) {
                $table->dropColumn('last_notification_payload');
            }
        });
    }
};
