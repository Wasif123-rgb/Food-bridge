<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Throwable;

class AdminController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | DATABASE OBJECTS
    |--------------------------------------------------------------------------
    */

    private function ensureDatabaseObjects(): void
    {
        /*
        |--------------------------------------------------------------------------
        | DATABASE VIEW
        |--------------------------------------------------------------------------
        */

        DB::statement("
            CREATE OR REPLACE VIEW admin_donation_summary AS
            SELECT
                food_category,
                COUNT(*) AS total_donations,
                COALESCE(SUM(quantity), 0) AS total_quantity
            FROM food_donations
            GROUP BY food_category
        ");

        /*
        |--------------------------------------------------------------------------
        | STORED PROCEDURE
        |--------------------------------------------------------------------------
        */

        $procedureExists = DB::selectOne("
            SELECT COUNT(*) AS total
            FROM information_schema.ROUTINES
            WHERE ROUTINE_SCHEMA = DATABASE()
              AND ROUTINE_TYPE = 'PROCEDURE'
              AND ROUTINE_NAME = 'get_admin_summary'
        ");

        if ((int) $procedureExists->total === 0) {
            DB::unprepared("
                CREATE PROCEDURE get_admin_summary()
                BEGIN
                    SELECT
                        (SELECT COUNT(*) FROM donors) AS total_donors,
                        (SELECT COUNT(*) FROM ngos) AS total_ngos,
                        (SELECT COUNT(*) FROM volunteers) AS total_volunteers,
                        (SELECT COUNT(*) FROM food_donations) AS total_donations,
                        (SELECT COUNT(*) FROM food_requests) AS total_requests,
                        (SELECT COUNT(*) FROM deliveries) AS total_deliveries,
                        (SELECT COUNT(*) FROM recipients) AS total_recipients;
                END
            ");
        }

        /*
        |--------------------------------------------------------------------------
        | NGO VERIFICATION TRIGGER
        |--------------------------------------------------------------------------
        */

        $ngoTriggerExists = DB::selectOne("
            SELECT COUNT(*) AS total
            FROM information_schema.TRIGGERS
            WHERE TRIGGER_SCHEMA = DATABASE()
              AND TRIGGER_NAME = 'prevent_verified_ngo_downgrade'
        ");

        if ((int) $ngoTriggerExists->total === 0) {
            DB::unprepared("
                CREATE TRIGGER prevent_verified_ngo_downgrade
                BEFORE UPDATE ON ngos
                FOR EACH ROW
                BEGIN
                    IF OLD.is_verified = 1
                       AND NEW.is_verified = 0 THEN

                        SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT =
                            'A verified NGO cannot be changed back to pending.';

                    END IF;
                END
            ");
        }

        /*
        |--------------------------------------------------------------------------
        | DELIVERY STATUS TRIGGER
        |--------------------------------------------------------------------------
        */

        $deliveryTriggerExists = DB::selectOne("
            SELECT COUNT(*) AS total
            FROM information_schema.TRIGGERS
            WHERE TRIGGER_SCHEMA = DATABASE()
              AND TRIGGER_NAME = 'prevent_delivered_status_downgrade'
        ");

        if ((int) $deliveryTriggerExists->total === 0) {
            DB::unprepared("
                CREATE TRIGGER prevent_delivered_status_downgrade
                BEFORE UPDATE ON deliveries
                FOR EACH ROW
                BEGIN
                    IF OLD.delivery_status = 'delivered'
                       AND NEW.delivery_status <> 'delivered' THEN

                        SIGNAL SQLSTATE '45000'
                        SET MESSAGE_TEXT =
                            'A delivered delivery cannot be changed back to another status.';

                    END IF;
                END
            ");
        }
    }

    /*
    |--------------------------------------------------------------------------
    | ADMIN DASHBOARD
    |--------------------------------------------------------------------------
    */

    public function dashboard()
    {
        $this->ensureDatabaseObjects();

        /*
        |--------------------------------------------------------------------------
        | STORED PROCEDURE
        |--------------------------------------------------------------------------
        */

        $procedureResult = DB::select(
            "CALL get_admin_summary()"
        );

        $procedureSummary = $procedureResult[0] ?? (object) [
            'total_donors' => 0,
            'total_ngos' => 0,
            'total_volunteers' => 0,
            'total_donations' => 0,
            'total_requests' => 0,
            'total_deliveries' => 0,
            'total_recipients' => 0,
        ];

        $totalDonors =
            (int) $procedureSummary->total_donors;

        $totalNgos =
            (int) $procedureSummary->total_ngos;

        $totalVolunteers =
            (int) $procedureSummary->total_volunteers;

        $totalDonations =
            (int) $procedureSummary->total_donations;

        $totalRequests =
            (int) $procedureSummary->total_requests;

        $totalDeliveries =
            (int) $procedureSummary->total_deliveries;

        $totalRecipients =
            (int) $procedureSummary->total_recipients;

        /*
        |--------------------------------------------------------------------------
        | NGO VERIFICATION COUNTS
        |--------------------------------------------------------------------------
        */

        $verifiedNgos = DB::selectOne("
            SELECT COUNT(*) AS total
            FROM ngos
            WHERE is_verified = 1
        ");

        $pendingNgos = DB::selectOne("
            SELECT COUNT(*) AS total
            FROM ngos
            WHERE is_verified = 0
        ");

        /*
        |--------------------------------------------------------------------------
        | NGOS
        |--------------------------------------------------------------------------
        */

        $ngos = DB::select("
            SELECT
                id,
                ngo_name,
                registration_no,
                email,
                phone,
                address,
                is_verified,
                created_at
            FROM ngos
            ORDER BY is_verified ASC, created_at DESC
        ");

        /*
        |--------------------------------------------------------------------------
        | DONATIONS BY CATEGORY
        |--------------------------------------------------------------------------
        */

        $donationsByCategory = DB::select("
            SELECT
                food_category,
                total_donations,
                total_quantity
            FROM admin_donation_summary
            ORDER BY total_donations DESC
        ");

        /*
        |--------------------------------------------------------------------------
        | DONATIONS BY DONOR
        |--------------------------------------------------------------------------
        */

        $donationsByDonor = DB::select("
            SELECT
                donors.id,
                donors.donor_name,
                COUNT(food_donations.id) AS total_donations,
                COALESCE(
                    SUM(food_donations.quantity),
                    0
                ) AS total_quantity
            FROM donors
            LEFT JOIN food_donations
                ON donors.id = food_donations.donor_id
            GROUP BY
                donors.id,
                donors.donor_name
            ORDER BY total_donations DESC
        ");

        /*
        |--------------------------------------------------------------------------
        | REQUESTS BY NGO
        |--------------------------------------------------------------------------
        */

        $requestsByNgo = DB::select("
            SELECT
                ngos.id,
                ngos.ngo_name,
                COUNT(food_requests.id) AS total_requests
            FROM ngos
            LEFT JOIN food_requests
                ON ngos.id = food_requests.ngo_id
            GROUP BY
                ngos.id,
                ngos.ngo_name
            ORDER BY total_requests DESC
        ");

        /*
        |--------------------------------------------------------------------------
        | REQUESTS BY STATUS
        |--------------------------------------------------------------------------
        */

        $requestsByStatus = DB::select("
            SELECT
                request_status,
                COUNT(*) AS total
            FROM food_requests
            GROUP BY request_status
        ");

        /*
        |--------------------------------------------------------------------------
        | DELIVERIES BY STATUS
        |--------------------------------------------------------------------------
        */

        $deliveriesByStatus = DB::select("
            SELECT
                delivery_status,
                COUNT(*) AS total
            FROM deliveries
            GROUP BY delivery_status
        ");

        /*
        |--------------------------------------------------------------------------
        | VOLUNTEER WORKLOAD
        |--------------------------------------------------------------------------
        */

        $volunteerWorkload = DB::select("
            SELECT
                volunteers.id,
                volunteers.full_name,
                volunteers.availability_status,
                COUNT(deliveries.id) AS total_deliveries
            FROM volunteers
            LEFT JOIN deliveries
                ON volunteers.id = deliveries.volunteer_id
            GROUP BY
                volunteers.id,
                volunteers.full_name,
                volunteers.availability_status
            ORDER BY total_deliveries DESC
        ");

        /*
        |--------------------------------------------------------------------------
        | RECIPIENTS BY NGO
        |--------------------------------------------------------------------------
        */

        $recipientsByNgo = DB::select("
            SELECT
                ngos.id,
                ngos.ngo_name,
                COUNT(recipients.id) AS total_recipients,
                COALESCE(
                    SUM(recipients.household_size),
                    0
                ) AS total_household_size
            FROM ngos
            LEFT JOIN recipients
                ON ngos.id = recipients.ngo_id
            GROUP BY
                ngos.id,
                ngos.ngo_name
            ORDER BY total_recipients DESC
        ");

        /*
        |--------------------------------------------------------------------------
        | REQUEST DETAILS
        |--------------------------------------------------------------------------
        */

        $requestDetails = DB::select("
            SELECT
                food_requests.id,
                donors.donor_name,
                food_donations.food_name,
                food_donations.food_category,
                ngos.ngo_name,
                food_requests.requested_qty,
                food_requests.request_status,
                food_requests.requested_at
            FROM food_requests
            JOIN ngos
                ON food_requests.ngo_id = ngos.id
            JOIN food_donations
                ON food_requests.donation_id = food_donations.id
            JOIN donors
                ON food_donations.donor_id = donors.id
            ORDER BY food_requests.requested_at DESC
            LIMIT 10
        ");

        /*
        |--------------------------------------------------------------------------
        | RECENT DELIVERIES
        |--------------------------------------------------------------------------
        */

        $recentDeliveries = DB::select("
            SELECT
                deliveries.id,
                food_donations.food_name,
                ngos.ngo_name,
                volunteers.full_name AS volunteer_name,
                deliveries.pickup_time,
                deliveries.delivered_at,
                deliveries.delivery_status
            FROM deliveries
            JOIN food_requests
                ON deliveries.request_id = food_requests.id
            JOIN ngos
                ON food_requests.ngo_id = ngos.id
            JOIN food_donations
                ON food_requests.donation_id = food_donations.id
            LEFT JOIN volunteers
                ON deliveries.volunteer_id = volunteers.id
            ORDER BY deliveries.created_at DESC
            LIMIT 10
        ");

        /*
        |--------------------------------------------------------------------------
        | RESPONSE
        |--------------------------------------------------------------------------
        */

        return response()->json([
            'success' => true,

            'summary' => [
                'donors' => $totalDonors,
                'ngos' => $totalNgos,
                'volunteers' => $totalVolunteers,
                'donations' => $totalDonations,
                'requests' => $totalRequests,
                'deliveries' => $totalDeliveries,
                'recipients' => $totalRecipients,
            ],

            'ngo_verification' => [
                'verified' => (int) $verifiedNgos->total,
                'pending' => (int) $pendingNgos->total,
            ],

            'ngos' => $ngos,

            'donations_by_category' =>
                $donationsByCategory,

            'donations_by_donor' =>
                $donationsByDonor,

            'requests_by_ngo' =>
                $requestsByNgo,

            'requests_by_status' =>
                $requestsByStatus,

            'request_details' =>
                $requestDetails,

            'deliveries_by_status' =>
                $deliveriesByStatus,

            'recent_deliveries' =>
                $recentDeliveries,

            'volunteer_workload' =>
                $volunteerWorkload,

            'recipients_by_ngo' =>
                $recipientsByNgo,

            'database_features' => [
                'view_name' =>
                    'admin_donation_summary',

                'view_description' =>
                    'Groups food donations by category and calculates total donation count and quantity.',

                'procedure_name' =>
                    'get_admin_summary()',

                'procedure_description' =>
                    'Returns the total donors, NGOs, volunteers, donations, requests, deliveries and recipients.',
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | RAW SQL TRANSACTION DEMONSTRATION
    |--------------------------------------------------------------------------
    */

    public function transactionDemo()
    {
        $connection = DB::connection();

        try {
            /*
            |--------------------------------------------------------------------------
            | CLEAN START
            |--------------------------------------------------------------------------
            |
            | Make absolutely sure an old temporary table from this connection
            | cannot interfere with the new demonstration.
            |
            */

            $connection->statement("
                DROP TEMPORARY TABLE IF EXISTS admin_transaction_demo
            ");

            /*
            |--------------------------------------------------------------------------
            | CREATE TEMPORARY TABLE
            |--------------------------------------------------------------------------
            */

            $connection->statement("
                CREATE TEMPORARY TABLE admin_transaction_demo (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    action_name VARCHAR(255) NOT NULL,
                    PRIMARY KEY (id)
                ) ENGINE=InnoDB
            ");

            /*
            |--------------------------------------------------------------------------
            | SQL EXECUTION RESULTS
            |--------------------------------------------------------------------------
            */

            $results = [];

            $resultId = 1;

            /*
            |--------------------------------------------------------------------------
            | TRANSACTION 1
            |--------------------------------------------------------------------------
            */

            $connection->statement(
                "START TRANSACTION"
            );

            $results[] = [
                'id' => $resultId++,
                'operation' => 'START TRANSACTION',
                'result' => 'Executed',
            ];

            /*
            | FIRST INSERT
            */

            $connection->statement("
                INSERT INTO admin_transaction_demo
                    (action_name)
                VALUES
                    ('Transaction 1 - committed row')
            ");

            $results[] = [
                'id' => $resultId++,
                'operation' =>
                    'INSERT INTO admin_transaction_demo',
                'result' => 'Executed',
            ];

            /*
            | SAVEPOINT
            */

            $connection->statement(
                "SAVEPOINT first_savepoint"
            );

            $results[] = [
                'id' => $resultId++,
                'operation' =>
                    'SAVEPOINT first_savepoint',
                'result' => 'Executed',
            ];

            /*
            | INSERT THAT WILL BE ROLLED BACK
            */

            $connection->statement("
                INSERT INTO admin_transaction_demo
                    (action_name)
                VALUES
                    ('Transaction 1 - savepoint rollback row')
            ");

            $results[] = [
                'id' => $resultId++,
                'operation' =>
                    'INSERT INTO admin_transaction_demo',
                'result' => 'Executed',
            ];

            /*
            | ROLLBACK TO SAVEPOINT
            */

            $connection->statement(
                "ROLLBACK TO SAVEPOINT first_savepoint"
            );

            $results[] = [
                'id' => $resultId++,
                'operation' =>
                    'ROLLBACK TO SAVEPOINT first_savepoint',
                'result' => 'Rolled Back',
            ];

            /*
            | INSERT AFTER SAVEPOINT ROLLBACK
            */

            $connection->statement("
                INSERT INTO admin_transaction_demo
                    (action_name)
                VALUES
                    ('Transaction 1 - post-savepoint row')
            ");

            $results[] = [
                'id' => $resultId++,
                'operation' =>
                    'INSERT INTO admin_transaction_demo',
                'result' => 'Executed',
            ];

            /*
            | RELEASE SAVEPOINT
            */

            $connection->statement(
                "RELEASE SAVEPOINT first_savepoint"
            );

            $results[] = [
                'id' => $resultId++,
                'operation' =>
                    'RELEASE SAVEPOINT first_savepoint',
                'result' => 'Executed',
            ];

            /*
            | COMMIT
            */

            $connection->statement(
                "COMMIT"
            );

            $results[] = [
                'id' => $resultId++,
                'operation' => 'COMMIT',
                'result' => 'Committed',
            ];

            /*
            |--------------------------------------------------------------------------
            | TRANSACTION 2
            |--------------------------------------------------------------------------
            */

            $connection->statement(
                "START TRANSACTION"
            );

            $results[] = [
                'id' => $resultId++,
                'operation' => 'START TRANSACTION',
                'result' => 'Executed',
            ];

            /*
            | INSERT
            */

            $connection->statement("
                INSERT INTO admin_transaction_demo
                    (action_name)
                VALUES
                    ('Transaction 2 - rollback row')
            ");

            $results[] = [
                'id' => $resultId++,
                'operation' =>
                    'INSERT INTO admin_transaction_demo',
                'result' => 'Executed',
            ];

            /*
            | SECOND SAVEPOINT
            */

            $connection->statement(
                "SAVEPOINT second_savepoint"
            );

            $results[] = [
                'id' => $resultId++,
                'operation' =>
                    'SAVEPOINT second_savepoint',
                'result' => 'Executed',
            ];

            /*
            | SECOND INSERT
            */

            $connection->statement("
                INSERT INTO admin_transaction_demo
                    (action_name)
                VALUES
                    ('Transaction 2 - second rollback row')
            ");

            $results[] = [
                'id' => $resultId++,
                'operation' =>
                    'INSERT INTO admin_transaction_demo',
                'result' => 'Executed',
            ];

            /*
            | FULL ROLLBACK
            */

            $connection->statement(
                "ROLLBACK"
            );

            $results[] = [
                'id' => $resultId++,
                'operation' => 'ROLLBACK',
                'result' => 'Rolled Back',
            ];

            /*
            |--------------------------------------------------------------------------
            | READ FINAL ROWS
            |--------------------------------------------------------------------------
            */

            $finalRows = $connection->select("
                SELECT
                    id,
                    action_name
                FROM admin_transaction_demo
                ORDER BY id ASC
            ");

            /*
            |--------------------------------------------------------------------------
            | CLEAN UP
            |--------------------------------------------------------------------------
            */

            $connection->statement("
                DROP TEMPORARY TABLE IF EXISTS admin_transaction_demo
            ");

            /*
            |--------------------------------------------------------------------------
            | RESPONSE
            |--------------------------------------------------------------------------
            */

            return response()->json([
                'success' => true,
                'results' => $results,
                'final_rows' => $finalRows,
            ]);

        } catch (Throwable $e) {

            /*
            |--------------------------------------------------------------------------
            | SAFETY ROLLBACK
            |--------------------------------------------------------------------------
            */

            try {
                $connection->statement(
                    "ROLLBACK"
                );
            } catch (Throwable $rollbackError) {
                // Ignore rollback failure.
            }

            /*
            |--------------------------------------------------------------------------
            | CLEAN TEMPORARY TABLE
            |--------------------------------------------------------------------------
            */

            try {
                $connection->statement("
                    DROP TEMPORARY TABLE IF EXISTS
                    admin_transaction_demo
                ");
            } catch (Throwable $dropError) {
                // Ignore cleanup failure.
            }

            return response()->json([
                'success' => false,
                'results' => [],
                'final_rows' => [],
            ], 500);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | VERIFY NGO
    |--------------------------------------------------------------------------
    */

    public function verifyNgo(string $id)
    {
        $ngo = DB::selectOne("
            SELECT *
            FROM ngos
            WHERE id = ?
            LIMIT 1
        ", [$id]);

        if (!$ngo) {
            return response()->json([
                'success' => false,
                'message' => 'NGO not found.',
            ], 404);
        }

        try {
            DB::update("
                UPDATE ngos
                SET is_verified = 1
                WHERE id = ?
            ", [$id]);

        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        $updatedNgo = DB::selectOne("
            SELECT *
            FROM ngos
            WHERE id = ?
            LIMIT 1
        ", [$id]);

        return response()->json([
            'success' => true,
            'message' => 'NGO verified successfully.',
            'data' => $updatedNgo,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | UNVERIFY NGO
    |--------------------------------------------------------------------------
    */

    public function unverifyNgo(string $id)
    {
        $ngo = DB::selectOne("
            SELECT *
            FROM ngos
            WHERE id = ?
            LIMIT 1
        ", [$id]);

        if (!$ngo) {
            return response()->json([
                'success' => false,
                'message' => 'NGO not found.',
            ], 404);
        }

        try {
            DB::update("
                UPDATE ngos
                SET is_verified = 0
                WHERE id = ?
            ", [$id]);

        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' =>
                    'A verified NGO cannot be changed back to pending.',
            ], 422);
        }

        $updatedNgo = DB::selectOne("
            SELECT *
            FROM ngos
            WHERE id = ?
            LIMIT 1
        ", [$id]);

        return response()->json([
            'success' => true,
            'message' => 'NGO verification removed.',
            'data' => $updatedNgo,
        ]);
    }
}