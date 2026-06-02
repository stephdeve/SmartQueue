<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('tickets', 'status')) {
            DB::statement("ALTER TABLE tickets MODIFY COLUMN status ENUM('waiting','called','en_route','present','absent','closed','canceled','expired') NOT NULL");
        }

        Schema::table('tickets', function ($table) {
            if (!Schema::hasColumn('tickets', 'present_at')) {
                $table->timestamp('present_at')->nullable()->after('en_route_at');
            }
            if (!Schema::hasColumn('tickets', 'en_route_expires_at')) {
                $table->timestamp('en_route_expires_at')->nullable()->after('present_at');
            }
            if (!Schema::hasColumn('tickets', 'response_received_at')) {
                $table->timestamp('response_received_at')->nullable()->after('en_route_expires_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function ($table) {
            $columns = [];
            if (Schema::hasColumn('tickets', 'present_at')) {
                $columns[] = 'present_at';
            }
            if (Schema::hasColumn('tickets', 'en_route_expires_at')) {
                $columns[] = 'en_route_expires_at';
            }
            if (Schema::hasColumn('tickets', 'response_received_at')) {
                $columns[] = 'response_received_at';
            }
            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });

        if (Schema::hasColumn('tickets', 'status')) {
            DB::statement("ALTER TABLE tickets MODIFY COLUMN status ENUM('waiting','called','absent','closed','canceled','expired') NOT NULL");
        }
    }
};
