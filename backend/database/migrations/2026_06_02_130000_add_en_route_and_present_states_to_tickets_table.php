<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            if (!Schema::hasColumn('tickets', 'present_at')) {
                $table->timestamp('present_at')->nullable();
            }
            if (!Schema::hasColumn('tickets', 'en_route_expires_at')) {
                $table->timestamp('en_route_expires_at')->nullable();
            }
            if (!Schema::hasColumn('tickets', 'response_received_at')) {
                $table->timestamp('response_received_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
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
    }
};
