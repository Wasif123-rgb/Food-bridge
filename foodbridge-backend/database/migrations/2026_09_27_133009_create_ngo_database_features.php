<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
        |--------------------------------------------------------------------------
        | 1. NGO Request Audit / Status Log Table
        |--------------------------------------------------------------------------
        */

        Schema::create('ngo_request_status_logs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('request_id')
                ->constrained('food_requests')
                ->cascadeOnDelete();

            $table->string('old_status')->nullable();
            $table->string('new_status');
            $table->string('action', 50);
            $table->timestamp('changed_at')->useCurrent();
        });

        /*
        |--------------------------------------------------------------------------
        | SQLite support for automated tests
        |--------------------------------------------------------------------------
        */

        if (DB::getDriverName() !== 'mysql') {
            $this->createSqliteView();
            return;
        }

        /*
        |--------------------------------------------------------------------------
        | 2. DATABASE VIEW
        |--------------------------------------------------------------------------
        */

        DB::statement('DROP VIEW IF EXISTS ngo_food_request_details');
        DB::statement($this->viewSql());

        /*
        |--------------------------------------------------------------------------
        | 3. STORED PROCEDURE + TRANSACTION
        |--------------------------------------------------------------------------
        */

        DB::unprepared(
            'DROP PROCEDURE IF EXISTS submit_ngo_food_request'
        );

        DB::unprepared($this->procedureSql());

        /*
        |--------------------------------------------------------------------------
        | 4. TRIGGERS
        |--------------------------------------------------------------------------
        */

        DB::unprepared(
            'DROP TRIGGER IF EXISTS log_ngo_food_request_created'
        );

        DB::unprepared(
            'DROP TRIGGER IF EXISTS log_ngo_request_status_change'
        );

        DB::unprepared($this->insertTriggerSql());
        DB::unprepared($this->updateTriggerSql());
    }


    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::unprepared(
                'DROP TRIGGER IF EXISTS log_ngo_food_request_created'
            );

            DB::unprepared(
                'DROP TRIGGER IF EXISTS log_ngo_request_status_change'
            );

            DB::unprepared(
                'DROP PROCEDURE IF EXISTS submit_ngo_food_request'
            );
        }

        DB::statement(
            'DROP VIEW IF EXISTS ngo_food_request_details'
        );

        Schema::dropIfExists('ngo_request_status_logs');
    }


    /*
    |--------------------------------------------------------------------------
    | VIEW
    |--------------------------------------------------------------------------
    |
    | Combines:
    | food_requests
    | + ngos
    | + food_donations
    | + donors
    |
    */

    private function viewSql(): string
    {
        return <<<'SQL'
CREATE OR REPLACE VIEW ngo_food_request_details AS
SELECT
    fr.id AS request_id,

    fr.ngo_id,
    n.ngo_name,
    n.registration_no,
    n.email AS ngo_email,
    n.phone AS ngo_phone,
    n.address AS ngo_address,

    fr.donation_id,

    fd.food_name,
    fd.food_category,
    fd.quantity AS donation_quantity,
    fd.unit,
    fd.prepared_at,
    fd.expiry_at,
    fd.availability_status,
    fd.donation_status,

    donor.id AS donor_id,
    donor.donor_name,
    donor.donor_type,
    donor.email AS donor_email,
    donor.phone AS donor_phone,
    donor.address AS donor_address,

    fr.requested_qty,
    fr.requested_at,
    fr.request_status

FROM food_requests fr

INNER JOIN ngos n
    ON n.id = fr.ngo_id

INNER JOIN food_donations fd
    ON fd.id = fr.donation_id

INNER JOIN donors donor
    ON donor.id = fd.donor_id
SQL;
    }


    /*
    |--------------------------------------------------------------------------
    | STORED PROCEDURE
    |--------------------------------------------------------------------------
    |
    | This procedure:
    |
    | 1. Starts a transaction
    | 2. Validates NGO
    | 3. Locks the selected food donation
    | 4. Checks availability and expiry
    | 5. Prevents duplicate active requests
    | 6. Calculates remaining quantity
    | 7. Creates the food request
    | 8. Commits if successful
    | 9. Rolls back automatically if anything fails
    |
    */

    private function procedureSql(): string
    {
        return <<<'SQL'
CREATE PROCEDURE submit_ngo_food_request(
    IN p_ngo_id BIGINT UNSIGNED,
    IN p_donation_id BIGINT UNSIGNED,
    IN p_requested_qty DECIMAL(10,2)
)
BEGIN
    DECLARE v_ngo_count INT DEFAULT 0;
    DECLARE v_found BOOLEAN DEFAULT TRUE;

    DECLARE v_total_qty DECIMAL(10,2);
    DECLARE v_reserved_qty DECIMAL(10,2) DEFAULT 0;
    DECLARE v_remaining_qty DECIMAL(10,2) DEFAULT 0;

    DECLARE v_availability_status VARCHAR(100);
    DECLARE v_donation_status VARCHAR(100);
    DECLARE v_expiry_at DATETIME;

    DECLARE v_active_request_count INT DEFAULT 0;
    DECLARE v_request_id BIGINT UNSIGNED;

    /*
     * Any SQL error causes the whole transaction
     * to be rolled back.
     */
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    /*
     * Validate NGO.
     */
    SELECT COUNT(*)
    INTO v_ngo_count
    FROM ngos
    WHERE id = p_ngo_id;

    IF v_ngo_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'NGO profile not found.';
    END IF;

    /*
     * Lock the donation row.
     *
     * FOR UPDATE prevents another request transaction
     * from changing the same donation simultaneously.
     */
    BEGIN
        DECLARE CONTINUE HANDLER
            FOR NOT FOUND SET v_found = FALSE;

        SELECT
            quantity,
            availability_status,
            donation_status,
            expiry_at
        INTO
            v_total_qty,
            v_availability_status,
            v_donation_status,
            v_expiry_at
        FROM food_donations
        WHERE id = p_donation_id
        FOR UPDATE;
    END;

    IF v_found = FALSE THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Food donation not found.';
    END IF;

    /*
     * Validate requested quantity.
     */
    IF p_requested_qty IS NULL
       OR p_requested_qty <= 0 THEN

        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Requested quantity must be greater than zero.';
    END IF;

    /*
     * Donation must still be active and available.
     */
    IF v_availability_status <> 'available'
       OR v_donation_status <> 'active' THEN

        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'This food donation is no longer available.';
    END IF;

    /*
     * Expired food cannot be requested.
     */
    IF v_expiry_at <= CURRENT_TIMESTAMP THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'This food donation has expired.';
    END IF;

    /*
     * Prevent the same NGO from creating another
     * active request for the same donation.
     */
    SELECT COUNT(*)
    INTO v_active_request_count
    FROM food_requests
    WHERE ngo_id = p_ngo_id
      AND donation_id = p_donation_id
      AND request_status IN (
          'pending',
          'approved',
          'in_progress'
      );

    IF v_active_request_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'You already have an active request for this donation.';
    END IF;

    /*
     * Calculate quantity already reserved by all NGOs.
     */
    SELECT COALESCE(
        SUM(requested_qty),
        0
    )
    INTO v_reserved_qty
    FROM food_requests
    WHERE donation_id = p_donation_id
      AND request_status IN (
          'pending',
          'approved',
          'in_progress'
      );

    SET v_remaining_qty =
        v_total_qty - v_reserved_qty;

    /*
     * Do not allow over-requesting.
     */
    IF p_requested_qty > v_remaining_qty THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Requested quantity is greater than the available quantity.';
    END IF;

    /*
     * Create the NGO food request.
     *
     * The INSERT trigger will automatically create
     * an audit/status-log record.
     */
    INSERT INTO food_requests (
        ngo_id,
        donation_id,
        requested_qty,
        requested_at,
        request_status,
        created_at,
        updated_at
    )
    VALUES (
        p_ngo_id,
        p_donation_id,
        p_requested_qty,
        CURRENT_TIMESTAMP,
        'pending',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

    SET v_request_id = LAST_INSERT_ID();

    COMMIT;

    /*
     * Return result to Laravel.
     */
    SELECT
        v_request_id AS request_id,
        p_ngo_id AS ngo_id,
        p_donation_id AS donation_id,
        p_requested_qty AS requested_qty,
        'pending' AS request_status,
        (
            v_remaining_qty - p_requested_qty
        ) AS remaining_qty,
        'Food request submitted successfully.'
            AS message;
END
SQL;
    }


    /*
    |--------------------------------------------------------------------------
    | INSERT TRIGGER
    |--------------------------------------------------------------------------
    |
    | Automatically records the initial pending status
    | whenever an NGO creates a food request.
    |
    */

    private function insertTriggerSql(): string
    {
        return <<<'SQL'
CREATE TRIGGER log_ngo_food_request_created
AFTER INSERT ON food_requests
FOR EACH ROW
BEGIN
    INSERT INTO ngo_request_status_logs (
        request_id,
        old_status,
        new_status,
        action,
        changed_at
    )
    VALUES (
        NEW.id,
        NULL,
        NEW.request_status,
        'request_created',
        CURRENT_TIMESTAMP
    );
END
SQL;
    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE TRIGGER
    |--------------------------------------------------------------------------
    |
    | Automatically records request status changes.
    |
    | Example:
    |
    | pending -> approved
    | approved -> in_progress
    | in_progress -> completed
    |
    */

    private function updateTriggerSql(): string
    {
        return <<<'SQL'
CREATE TRIGGER log_ngo_request_status_change
AFTER UPDATE ON food_requests
FOR EACH ROW
BEGIN
    IF NOT (
        OLD.request_status
        <=>
        NEW.request_status
    ) THEN

        INSERT INTO ngo_request_status_logs (
            request_id,
            old_status,
            new_status,
            action,
            changed_at
        )
        VALUES (
            NEW.id,
            OLD.request_status,
            NEW.request_status,
            'status_changed',
            CURRENT_TIMESTAMP
        );

    END IF;
END
SQL;
    }


    /*
    |--------------------------------------------------------------------------
    | SQLite test VIEW
    |--------------------------------------------------------------------------
    |
    | Stored procedures and MySQL triggers are skipped
    | for SQLite automated tests.
    |
    */

    private function createSqliteView(): void
    {
        DB::statement(
            'DROP VIEW IF EXISTS ngo_food_request_details'
        );

        DB::statement(<<<'SQL'
CREATE VIEW ngo_food_request_details AS
SELECT
    fr.id AS request_id,

    fr.ngo_id,
    n.ngo_name,
    n.registration_no,
    n.email AS ngo_email,
    n.phone AS ngo_phone,
    n.address AS ngo_address,

    fr.donation_id,

    fd.food_name,
    fd.food_category,
    fd.quantity AS donation_quantity,
    fd.unit,
    fd.prepared_at,
    fd.expiry_at,
    fd.availability_status,
    fd.donation_status,

    donor.id AS donor_id,
    donor.donor_name,
    donor.donor_type,
    donor.email AS donor_email,
    donor.phone AS donor_phone,
    donor.address AS donor_address,

    fr.requested_qty,
    fr.requested_at,
    fr.request_status

FROM food_requests fr

INNER JOIN ngos n
    ON n.id = fr.ngo_id

INNER JOIN food_donations fd
    ON fd.id = fr.donation_id

INNER JOIN donors donor
    ON donor.id = fd.donor_id
SQL);
    }
};