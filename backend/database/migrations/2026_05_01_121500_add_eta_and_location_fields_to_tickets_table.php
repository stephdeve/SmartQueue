<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Add eta_minutes (persisted ETA) and last_lat/last_lng (user location) to tickets.
     */
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            if (!Schema::hasColumn('tickets', 'eta_minutes')) {
                $table->unsignedInteger('eta_minutes')->nullable()->after('position');
            }

            if (!Schema::hasColumn('tickets', 'last_lat')) {
                $table->decimal('last_lat', 10, 8)->nullable()->after('last_distance_m');
            }

            if (!Schema::hasColumn('tickets', 'last_lng')) {
                $table->decimal('last_lng', 11, 8)->nullable()->after('last_lat');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $columns = [];
            if (Schema::hasColumn('tickets', 'eta_minutes')) {
                $columns[] = 'eta_minutes';
            }
            if (Schema::hasColumn('tickets', 'last_lat')) {
                $columns[] = 'last_lat';
            }
            if (Schema::hasColumn('tickets', 'last_lng')) {
                $columns[] = 'last_lng';
            }

            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
