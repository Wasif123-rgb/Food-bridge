<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipients', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->after('id');
            $table->unique('user_id');
        });

        if (DB::getDriverName() === 'mysql') {
            Schema::table('recipients', function (Blueprint $table) {
                $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::table('recipients', function (Blueprint $table) {
            if (DB::getDriverName() === 'mysql') {
                $table->dropForeign(['user_id']);
            }
            $table->dropUnique(['user_id']);
            $table->dropColumn('user_id');
        });
    }
};
