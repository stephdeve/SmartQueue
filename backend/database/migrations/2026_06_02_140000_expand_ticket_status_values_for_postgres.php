<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('tickets', 'status')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            $constraints = DB::select("SELECT conname FROM pg_constraint WHERE conrelid = 'tickets'::regclass AND pg_get_constraintdef(oid) ILIKE '%status%'");
            foreach ($constraints as $constraint) {
                DB::statement('ALTER TABLE tickets DROP CONSTRAINT IF EXISTS "'.$constraint->conname.'"');
            }
            DB::statement("ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('waiting','called','en_route','present','absent','closed','canceled','expired'))");
            return;
        }

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE tickets MODIFY COLUMN status ENUM('waiting','called','en_route','present','absent','closed','canceled','expired') NOT NULL");
        }
    }

    public function down(): void
    {
        if (!Schema::hasColumn('tickets', 'status')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            $constraints = DB::select("SELECT conname FROM pg_constraint WHERE conrelid = 'tickets'::regclass AND pg_get_constraintdef(oid) ILIKE '%status%'");
            foreach ($constraints as $constraint) {
                DB::statement('ALTER TABLE tickets DROP CONSTRAINT IF EXISTS "'.$constraint->conname.'"');
            }
            DB::statement("ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('waiting','called','absent','closed','canceled','expired'))");
            return;
        }

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE tickets MODIFY COLUMN status ENUM('waiting','called','absent','closed','canceled','expired') NOT NULL");
        }
    }
};
