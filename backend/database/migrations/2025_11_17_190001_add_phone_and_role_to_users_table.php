<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Ajoute les colonnes phone et role si elles n'existent pas
            if (!Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 32)->nullable()->unique()->after('password');
            }
            if (!Schema::hasColumn('users', 'role')) {
                $table->string('role', 16)->default('user')->after('phone');
                $table->index(['role']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'role')) {
                $table->dropIndex(['role']);
                $table->dropColumn('role');
            }
            if (Schema::hasColumn('users', 'phone')) {
                $table->dropUnique('users_phone_unique');
                $table->dropColumn('phone');
            }
        });
    }
};
