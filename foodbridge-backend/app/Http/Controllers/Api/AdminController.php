<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ngo;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    // ==========================================
    // CREATE REQUIRED DATABASE OBJECTS
    // VIEW + STORED PROCEDURE
    // ==========================================

    private function ensureDatabaseObjects(): void
    {
        // ==========================================
        // DATABASE VIEW
        // ==========================================

        DB::statement("
            CREATE OR REPLACE VIEW admin_donation_summary AS
            SELECT
                food_category,
                COUNT(*) AS total_donations,
                COALESCE(SUM(quantity), 0) AS total_quantity
            FROM food_donations
            GROUP BY food_category
        ");

        // ==========================================
        // CHECK STORED PROCEDURE
        // ==========================================

        $procedureExists = DB::selectOne("
            SELECT COUNT(*) AS total
            FROM information_schema.ROUTINES
            WHERE ROUTINE_SCHEMA = DATABASE()
              AND ROUTINE_TYPE = 'PROCEDURE'
              AND ROUTINE_NAME = 'get_admin_summary'
        ");

        // ==========================================
        // CREATE STORED PROCEDURE IF MISSING
        // ==========================================

        if ((int) $procedureExists->total === 0) {

            DB::unprepared("
                CREATE PROCEDURE get_admin_summary()
                BEGIN

                    SELECT

                        (
                            SELECT COUNT(*)
                            FROM donors
                        ) AS total_donors,

                        (
                            SELECT COUNT(*)
                            FROM ngos
                        ) AS total_ngos,

                        (
                            SELECT COUNT(*)
                            FROM volunteers
                        ) AS total_volunteers,

                        (
                            SELECT COUNT(*)
                            FROM food_donations
                        ) AS total_donations,

                        (
                            SELECT COUNT(*)
                            FROM food_requests
                        ) AS total_requests,

                        (
                            SELECT COUNT(*)
                            FROM deliveries
                        ) AS total_deliveries,

                        (
                            SELECT COUNT(*)
                            FROM recipients
                        ) AS total_recipients;

                END
            ");
        }
    }


    // ==========================================
    // ADMIN DASHBOARD
    // ==========================================

    public function dashboard()
    {
        // Make sure View and Stored Procedure exist.
        $this->ensureDatabaseObjects();


        // ==========================================
        // 1. SUMMARY COUNTS
        // STORED PROCEDURE
        // ==========================================

        $procedureResult = DB::select(
            "CALL get_admin_summary()"
        );

        $procedureSummary =
            $procedureResult[0]
            ?? (object) [

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


        // ==========================================
        // 2. NGO VERIFICATION
        // RAW SQL
        // ==========================================

        $verifiedNgos = DB::selectOne("
            SELECT COUNT(*) AS total
            FROM ngos
            WHERE is_verified = 1
        ")->total;


        $pendingNgos = DB::selectOne("
            SELECT COUNT(*) AS total
            FROM ngos
            WHERE is_verified = 0
        ")->total;


        // ==========================================
        // 3. NGO LIST
        // RAW SQL
        // ==========================================

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
            ORDER BY
                is_verified ASC,
                created_at DESC
        ");


        // ==========================================
        // 4. DONATIONS BY FOOD CATEGORY
        // DATABASE VIEW
        // ==========================================

        $donationsByCategory = DB::select("
            SELECT
                food_category,
                total_donations,
                total_quantity
            FROM admin_donation_summary
            ORDER BY total_donations DESC
        ");


        // ==========================================
        // 5. DONATIONS BY DONOR
        // RAW SQL + LEFT JOIN + GROUP BY
        // ==========================================

        $donationsByDonor = DB::select("
            SELECT

                donors.id,

                donors.donor_name,

                COUNT(
                    food_donations.id
                ) AS total_donations,

                COALESCE(
                    SUM(
                        food_donations.quantity
                    ),
                    0
                ) AS total_quantity

            FROM donors

            LEFT JOIN food_donations
                ON donors.id =
                   food_donations.donor_id

            GROUP BY
                donors.id,
                donors.donor_name

            ORDER BY
                total_donations DESC
        ");


        // ==========================================
        // 6. REQUESTS BY NGO
        // RAW SQL + LEFT JOIN + GROUP BY
        // ==========================================

        $requestsByNgo = DB::select("
            SELECT

                ngos.id,

                ngos.ngo_name,

                COUNT(
                    food_requests.id
                ) AS total_requests

            FROM ngos

            LEFT JOIN food_requests
                ON ngos.id =
                   food_requests.ngo_id

            GROUP BY
                ngos.id,
                ngos.ngo_name

            ORDER BY
                total_requests DESC
        ");


        // ==========================================
        // 7. REQUESTS BY STATUS
        // RAW SQL + GROUP BY
        // ==========================================

        $requestsByStatus = DB::select("
            SELECT

                request_status,

                COUNT(*) AS total

            FROM food_requests

            GROUP BY request_status
        ");


        // ==========================================
        // 8. DELIVERIES BY STATUS
        // RAW SQL + GROUP BY
        // ==========================================

        $deliveriesByStatus = DB::select("
            SELECT

                delivery_status,

                COUNT(*) AS total

            FROM deliveries

            GROUP BY delivery_status
        ");


        // ==========================================
        // 9. VOLUNTEER WORKLOAD
        // RAW SQL + LEFT JOIN + GROUP BY
        // ==========================================

        $volunteerWorkload = DB::select("
            SELECT

                volunteers.id,

                volunteers.full_name,

                volunteers.availability_status,

                COUNT(
                    deliveries.id
                ) AS total_deliveries

            FROM volunteers

            LEFT JOIN deliveries
                ON volunteers.id =
                   deliveries.volunteer_id

            GROUP BY

                volunteers.id,

                volunteers.full_name,

                volunteers.availability_status

            ORDER BY
                total_deliveries DESC
        ");


        // ==========================================
        // 10. RECIPIENTS BY NGO
        // RAW SQL + LEFT JOIN + GROUP BY
        // ==========================================

        $recipientsByNgo = DB::select("
            SELECT

                ngos.id,

                ngos.ngo_name,

                COUNT(
                    recipients.id
                ) AS total_recipients,

                COALESCE(
                    SUM(
                        recipients.household_size
                    ),
                    0
                ) AS total_household_size

            FROM ngos

            LEFT JOIN recipients
                ON ngos.id =
                   recipients.ngo_id

            GROUP BY

                ngos.id,

                ngos.ngo_name

            ORDER BY
                total_recipients DESC
        ");


        // ==========================================
        // 11. DONATION REQUEST DETAILS
        // RAW SQL + JOIN
        // ==========================================

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
                ON food_requests.ngo_id =
                   ngos.id

            JOIN food_donations
                ON food_requests.donation_id =
                   food_donations.id

            JOIN donors
                ON food_donations.donor_id =
                   donors.id

            ORDER BY
                food_requests.requested_at DESC

            LIMIT 10
        ");


        // ==========================================
        // 12. RECENT DELIVERIES
        // RAW SQL + MULTIPLE JOINS
        // ==========================================

        $recentDeliveries = DB::select("
            SELECT

                deliveries.id,

                food_donations.food_name,

                ngos.ngo_name,

                volunteers.full_name
                    AS volunteer_name,

                deliveries.pickup_time,

                deliveries.delivered_at,

                deliveries.delivery_status

            FROM deliveries

            JOIN food_requests
                ON deliveries.request_id =
                   food_requests.id

            JOIN ngos
                ON food_requests.ngo_id =
                   ngos.id

            JOIN food_donations
                ON food_requests.donation_id =
                   food_donations.id

            LEFT JOIN volunteers
                ON deliveries.volunteer_id =
                   volunteers.id

            ORDER BY
                deliveries.created_at DESC

            LIMIT 10
        ");


        // ==========================================
        // RETURN DASHBOARD DATA
        // ==========================================

        return response()->json([

            'success' => true,


            // ======================================
            // SUMMARY
            // ======================================

            'summary' => [

                'donors' =>
                    $totalDonors,

                'ngos' =>
                    $totalNgos,

                'volunteers' =>
                    $totalVolunteers,

                'donations' =>
                    $totalDonations,

                'requests' =>
                    $totalRequests,

                'deliveries' =>
                    $totalDeliveries,

                'recipients' =>
                    $totalRecipients,
            ],


            // ======================================
            // NGO VERIFICATION
            // ======================================

            'ngo_verification' => [

                'verified' =>
                    $verifiedNgos,

                'pending' =>
                    $pendingNgos,
            ],


            // ======================================
            // NGO LIST
            // ======================================

            'ngos' =>
                $ngos,


            // ======================================
            // DONATIONS
            // ======================================

            'donations_by_category' =>
                $donationsByCategory,

            'donations_by_donor' =>
                $donationsByDonor,


            // ======================================
            // REQUESTS
            // ======================================

            'requests_by_ngo' =>
                $requestsByNgo,

            'requests_by_status' =>
                $requestsByStatus,

            'request_details' =>
                $requestDetails,


            // ======================================
            // DELIVERIES
            // ======================================

            'deliveries_by_status' =>
                $deliveriesByStatus,

            'recent_deliveries' =>
                $recentDeliveries,


            // ======================================
            // VOLUNTEERS
            // ======================================

            'volunteer_workload' =>
                $volunteerWorkload,


            // ======================================
            // RECIPIENTS
            // ======================================

            'recipients_by_ngo' =>
                $recipientsByNgo,


            // ======================================
            // DATABASE IMPLEMENTATION
            // ======================================

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


    // ==========================================
    // VERIFY NGO
    // PUT:
    // /api/admin/ngos/{id}/verify
    // ==========================================

    public function verifyNgo(string $id)
    {
        $ngo =
            Ngo::findOrFail($id);


        DB::update("
            UPDATE ngos

            SET is_verified = 1

            WHERE id = ?
        ", [$id]);


        $ngo =
            Ngo::findOrFail($id);


        return response()->json([

            'success' =>
                true,

            'message' =>
                'NGO verified successfully.',

            'data' =>
                $ngo,
        ]);
    }


    // ==========================================
    // UNVERIFY NGO
    // PUT:
    // /api/admin/ngos/{id}/unverify
    // ==========================================

    public function unverifyNgo(string $id)
    {
        $ngo =
            Ngo::findOrFail($id);


        DB::update("
            UPDATE ngos

            SET is_verified = 0

            WHERE id = ?
        ", [$id]);


        $ngo =
            Ngo::findOrFail($id);


        return response()->json([

            'success' =>
                true,

            'message' =>
                'NGO verification removed.',

            'data' =>
                $ngo,
        ]);
    }
}