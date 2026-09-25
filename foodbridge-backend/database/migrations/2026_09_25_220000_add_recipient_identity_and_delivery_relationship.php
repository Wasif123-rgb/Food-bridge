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
            $table->unsignedInteger('recipient_no')->nullable()->after('ngo_id');
        });

        $numbersByNgo = [];
        foreach (DB::select('SELECT id, ngo_id FROM recipients ORDER BY ngo_id, id') as $recipient) {
            $numbersByNgo[$recipient->ngo_id] = ($numbersByNgo[$recipient->ngo_id] ?? 0) + 1;
            DB::update(
                'UPDATE recipients SET recipient_no = ? WHERE id = ?',
                [$numbersByNgo[$recipient->ngo_id], $recipient->id]
            );
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE recipients MODIFY recipient_no INT UNSIGNED NOT NULL');
        }

        Schema::table('recipients', function (Blueprint $table) {
            $table->unique(['ngo_id', 'recipient_no']);
        });

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('DROP VIEW IF EXISTS volunteer_delivery_details');
        }

        Schema::table('deliveries', function (Blueprint $table) {
            $table->foreignId('recipient_id')
                ->nullable()
                ->after('volunteer_id')
                ->constrained('recipients')
                ->nullOnDelete();
        });

        DB::statement(<<<'SQL'
CREATE VIEW recipient_delivery_details AS
SELECT
    r.ngo_id,
    r.recipient_no,
    r.id AS recipient_id,
    r.full_name AS recipient_name,
    r.address AS recipient_address,
    r.phone AS recipient_phone,
    r.household_size,
    n.ngo_name,
    d.id AS delivery_id,
    d.request_id,
    d.volunteer_id,
    v.full_name AS volunteer_name,
    v.phone AS volunteer_phone,
    d.pickup_time,
    d.delivery_status,
    d.delivered_at,
    fd.id AS donation_id,
    fd.food_name,
    fd.food_category,
    fr.requested_qty AS quantity,
    fd.unit,
    CASE
        WHEN LOWER(d.delivery_status) = 'delivered'
         AND d.delivered_at IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.delivery_id = d.id)
        THEN 1 ELSE 0
    END AS can_submit_feedback,
    d.created_at,
    d.updated_at
FROM recipients r
INNER JOIN ngos n ON n.id = r.ngo_id
INNER JOIN deliveries d ON d.recipient_id = r.id
INNER JOIN food_requests fr ON fr.id = d.request_id
INNER JOIN food_donations fd ON fd.id = fr.donation_id
LEFT JOIN volunteers v ON v.id = d.volunteer_id
SQL);

        if (DB::getDriverName() === 'sqlite') {
            $this->recreateSqliteVolunteerView();
        }
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS recipient_delivery_details');

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('DROP VIEW IF EXISTS volunteer_delivery_details');
        }

        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recipient_id');
        });

        Schema::table('recipients', function (Blueprint $table) {
            $table->dropUnique(['ngo_id', 'recipient_no']);
            $table->dropColumn('recipient_no');
        });

        if (DB::getDriverName() === 'sqlite') {
            $this->recreateSqliteVolunteerView();
        }
    }

    private function recreateSqliteVolunteerView(): void
    {
        DB::statement(<<<'SQL'
CREATE VIEW volunteer_delivery_details AS
SELECT
    d.id AS delivery_id, d.request_id, d.volunteer_id,
    v.user_id AS volunteer_user_id, v.full_name AS volunteer_name,
    v.email AS volunteer_email, v.phone AS volunteer_phone,
    n.id AS ngo_id, n.ngo_name, n.email AS ngo_email,
    n.phone AS ngo_phone, n.address AS ngo_address,
    fd.id AS donation_id, fd.food_name, fd.food_category,
    fr.requested_qty AS quantity, fd.unit,
    donor.donor_name AS pickup_contact, donor.phone AS pickup_phone,
    donor.address AS pickup_address,
    NULL AS recipient_name, NULL AS recipient_phone,
    NULL AS destination_address, NULL AS household_size,
    d.pickup_time, d.delivery_status, d.delivered_at,
    fr.request_status, d.created_at, d.updated_at
FROM deliveries d
JOIN volunteers v ON v.id = d.volunteer_id
JOIN food_requests fr ON fr.id = d.request_id
JOIN ngos n ON n.id = fr.ngo_id
JOIN food_donations fd ON fd.id = fr.donation_id
JOIN donors donor ON donor.id = fd.donor_id
SQL);
    }
};
