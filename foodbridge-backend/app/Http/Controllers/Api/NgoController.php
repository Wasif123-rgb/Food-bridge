<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ngo;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NgoController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | NGO CRUD
    |--------------------------------------------------------------------------
    */

    // GET: /api/ngos
    public function index()
    {
        $ngos = Ngo::latest()->get();

        return response()->json([
            'success' => true,
            'message' => 'NGOs retrieved successfully',
            'data' => $ngos,
        ]);
    }

    // POST: /api/ngos
    public function store(Request $request)
    {
        $validated = $request->validate([
            'ngo_name' => 'required|string|max:255|unique:ngos,ngo_name',
            'registration_no' => 'required|string|max:255|unique:ngos,registration_no',
            'email' => 'required|email|unique:ngos,email',
            'phone' => 'required|string|max:30',
            'address' => 'nullable|string',
            'is_verified' => 'sometimes|boolean',
        ]);

        $ngo = Ngo::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'NGO created successfully',
            'data' => $ngo,
        ], 201);
    }

    // GET: /api/ngos/{id}
    public function show(string $id)
    {
        $ngo = Ngo::findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $ngo,
        ]);
    }

    // PUT/PATCH: /api/ngos/{id}
    public function update(Request $request, string $id)
    {
        $ngo = Ngo::findOrFail($id);

        $validated = $request->validate([
            'ngo_name' => 'sometimes|required|string|max:255|unique:ngos,ngo_name,' . $ngo->id,
            'registration_no' => 'sometimes|required|string|max:255|unique:ngos,registration_no,' . $ngo->id,
            'email' => 'sometimes|required|email|unique:ngos,email,' . $ngo->id,
            'phone' => 'sometimes|required|string|max:30',
            'address' => 'nullable|string',
            'is_verified' => 'sometimes|boolean',
        ]);

        $ngo->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'NGO updated successfully',
            'data' => $ngo,
        ]);
    }

    // DELETE: /api/ngos/{id}
    public function destroy(string $id)
    {
        $ngo = Ngo::findOrFail($id);
        $ngo->delete();

        return response()->json([
            'success' => true,
            'message' => 'NGO deleted successfully',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Logged-in NGO Profile
    |--------------------------------------------------------------------------
    */

    // GET: /api/ngo/profile
    public function profile(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'ngo') {
            return response()->json([
                'success' => false,
                'message' => 'Only NGO users can access this page.',
            ], 403);
        }

        $ngo = Ngo::where('email', $user->email)->first();

        if (!$ngo) {
            return response()->json([
                'success' => false,
                'message' => 'NGO profile not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'NGO profile retrieved successfully',
            'data' => $ngo,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Available Food Donations - JOIN + Aggregate Functions
    |--------------------------------------------------------------------------
    |
    | Concepts used:
    | - INNER JOIN
    | - LEFT JOIN
    | - GROUP BY
    | - SUM
    | - COALESCE
    |
    */

    // GET: /api/ngo/available-donations
    public function availableDonations(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'ngo') {
            return response()->json([
                'success' => false,
                'message' => 'Only NGO users can view available donations.',
            ], 403);
        }

        $ngo = Ngo::where('email', $user->email)->first();

        if (!$ngo) {
            return response()->json([
                'success' => false,
                'message' => 'Please complete your NGO profile first.',
            ], 404);
        }

        $donations = DB::table('food_donations')
            ->join(
                'donors',
                'food_donations.donor_id',
                '=',
                'donors.id'
            )
            ->leftJoin('food_requests', function ($join) {
                $join->on(
                    'food_donations.id',
                    '=',
                    'food_requests.donation_id'
                )
                ->whereIn('food_requests.request_status', [
                    'pending',
                    'approved',
                    'in_progress',
                ]);
            })
            ->where('food_donations.availability_status', 'available')
            ->where('food_donations.donation_status', 'active')
            ->where('food_donations.expiry_at', '>', now())
            ->select(
                'food_donations.id',
                'food_donations.donor_id',
                'food_donations.food_name',
                'food_donations.food_category',
                'food_donations.quantity',
                'food_donations.unit',
                'food_donations.prepared_at',
                'food_donations.expiry_at',
                'food_donations.availability_status',
                'food_donations.donation_status',
                'donors.id as joined_donor_id',
                'donors.donor_name',
                'donors.donor_type',
                'donors.email as donor_email',
                'donors.phone as donor_phone',
                'donors.address as donor_address',
                DB::raw(
                    'COALESCE(SUM(food_requests.requested_qty), 0) as reserved_qty'
                ),
                DB::raw(
                    '(food_donations.quantity - COALESCE(SUM(food_requests.requested_qty), 0)) as remaining_qty'
                )
            )
            ->groupBy(
                'food_donations.id',
                'food_donations.donor_id',
                'food_donations.food_name',
                'food_donations.food_category',
                'food_donations.quantity',
                'food_donations.unit',
                'food_donations.prepared_at',
                'food_donations.expiry_at',
                'food_donations.availability_status',
                'food_donations.donation_status',
                'donors.id',
                'donors.donor_name',
                'donors.donor_type',
                'donors.email',
                'donors.phone',
                'donors.address'
            )
            ->havingRaw(
                '(food_donations.quantity - COALESCE(SUM(food_requests.requested_qty), 0)) > 0'
            )
            ->orderBy('food_donations.expiry_at')
            ->get();

        $donations = $donations->map(function ($row) {
            return [
                'id' => $row->id,
                'donor_id' => $row->donor_id,
                'food_name' => $row->food_name,
                'food_category' => $row->food_category,
                'quantity' => $row->quantity,
                'unit' => $row->unit,
                'prepared_at' => $row->prepared_at,
                'expiry_at' => $row->expiry_at,
                'availability_status' => $row->availability_status,
                'donation_status' => $row->donation_status,
                'reserved_qty' => $row->reserved_qty,
                'remaining_qty' => $row->remaining_qty,
                'donor' => [
                    'id' => $row->joined_donor_id,
                    'donor_name' => $row->donor_name,
                    'donor_type' => $row->donor_type,
                    'email' => $row->donor_email,
                    'phone' => $row->donor_phone,
                    'address' => $row->donor_address,
                ],
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Available food donations retrieved successfully using joins and aggregate functions',
            'data' => $donations,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | My Food Requests - DATABASE VIEW
    |--------------------------------------------------------------------------
    |
    | Reads from:
    | ngo_food_request_details
    |
    | The view combines:
    | food_requests + ngos + food_donations + donors
    |
    */

    // GET: /api/ngo/requests
    public function myRequests(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'ngo') {
            return response()->json([
                'success' => false,
                'message' => 'Only NGO users can view food requests.',
            ], 403);
        }

        $ngo = Ngo::where('email', $user->email)->first();

        if (!$ngo) {
            return response()->json([
                'success' => false,
                'message' => 'NGO profile not found.',
            ], 404);
        }

        $rows = DB::table('ngo_food_request_details')
            ->where('ngo_id', $ngo->id)
            ->orderByDesc('requested_at')
            ->get();

        $foodRequests = $rows->map(function ($row) {
            return [
                'id' => $row->request_id,
                'ngo_id' => $row->ngo_id,
                'ngo_name' => $row->ngo_name,
                'donation_id' => $row->donation_id,
                'requested_qty' => $row->requested_qty,
                'requested_at' => $row->requested_at,
                'request_status' => $row->request_status,
                'donation' => [
                    'id' => $row->donation_id,
                    'food_name' => $row->food_name,
                    'food_category' => $row->food_category,
                    'quantity' => $row->donation_quantity,
                    'unit' => $row->unit,
                    'prepared_at' => $row->prepared_at,
                    'expiry_at' => $row->expiry_at,
                    'availability_status' => $row->availability_status,
                    'donation_status' => $row->donation_status,
                    'donor' => [
                        'id' => $row->donor_id,
                        'donor_name' => $row->donor_name,
                        'donor_type' => $row->donor_type,
                        'email' => $row->donor_email,
                        'phone' => $row->donor_phone,
                        'address' => $row->donor_address,
                    ],
                ],
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Your food requests retrieved successfully using database view',
            'data' => $foodRequests,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Request Food - STORED PROCEDURE + TRANSACTION + TRIGGER
    |--------------------------------------------------------------------------
    |
    | Frontend button
    |     -> POST /api/ngo/requests
    |     -> CALL submit_ngo_food_request(...)
    |
    | Stored procedure performs:
    | - START TRANSACTION
    | - Validation
    | - SELECT ... FOR UPDATE
    | - Duplicate request check
    | - Remaining quantity calculation
    | - INSERT food_requests
    | - COMMIT
    |
    | If an SQL exception occurs:
    | - ROLLBACK
    |
    | The INSERT trigger automatically writes to:
    | ngo_request_status_logs
    |
    */

    // POST: /api/ngo/requests
    public function requestFood(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'ngo') {
            return response()->json([
                'success' => false,
                'message' => 'Only NGO users can request food.',
            ], 403);
        }

        $ngo = Ngo::where('email', $user->email)->first();

        if (!$ngo) {
            return response()->json([
                'success' => false,
                'message' => 'Please complete your NGO profile first.',
            ], 404);
        }

        $validated = $request->validate([
            'donation_id' => 'required|integer|exists:food_donations,id',
            'requested_qty' => 'required|numeric|min:0.01',
        ]);

        try {
            $result = DB::select(
                'CALL submit_ngo_food_request(?, ?, ?)',
                [
                    $ngo->id,
                    $validated['donation_id'],
                    $validated['requested_qty'],
                ]
            );

            $procedureResult = count($result) > 0
                ? $result[0]
                : null;

            return response()->json([
                'success' => true,
                'message' => $procedureResult->message
                    ?? 'Food request submitted successfully.',
                'data' => [
                    'request_id' => $procedureResult->request_id ?? null,
                    'ngo_id' => $procedureResult->ngo_id ?? $ngo->id,
                    'donation_id' => $procedureResult->donation_id
                        ?? $validated['donation_id'],
                    'requested_qty' => $procedureResult->requested_qty
                        ?? $validated['requested_qty'],
                    'request_status' => $procedureResult->request_status
                        ?? 'pending',
                    'remaining_qty' => $procedureResult->remaining_qty
                        ?? null,
                ],
            ], 201);
        } catch (QueryException $exception) {
            $databaseMessage = $exception->errorInfo[2]
                ?? 'Unable to submit food request.';

            return response()->json([
                'success' => false,
                'message' => $databaseMessage,
            ], 422);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Request Status History - TRIGGER LOG
    |--------------------------------------------------------------------------
    |
    | The database triggers write request status changes into:
    | ngo_request_status_logs
    |
    | This endpoint exposes only the currently logged-in NGO's history
    | so the trigger activity can be displayed on the frontend.
    |
    */

    // GET: /api/ngo/request-status-history
    public function requestStatusHistory(Request $request)
    {
        $user = $request->user();

        if (!$user || $user->role !== 'ngo') {
            return response()->json([
                'success' => false,
                'message' => 'Only NGO users can view request status history.',
            ], 403);
        }

        $ngo = Ngo::where('email', $user->email)->first();

        if (!$ngo) {
            return response()->json([
                'success' => false,
                'message' => 'NGO profile not found.',
            ], 404);
        }

        $history = DB::table('ngo_request_status_logs as logs')
            ->join(
                'food_requests as requests',
                'logs.request_id',
                '=',
                'requests.id'
            )
            ->join(
                'food_donations as donations',
                'requests.donation_id',
                '=',
                'donations.id'
            )
            ->where('requests.ngo_id', $ngo->id)
            ->select(
                'logs.id',
                'logs.request_id',
                'logs.old_status',
                'logs.new_status',
                'logs.action',
                'logs.changed_at',
                'requests.donation_id',
                'requests.requested_qty',
                'donations.food_name',
                'donations.unit'
            )
            ->orderByDesc('logs.changed_at')
            ->orderByDesc('logs.id')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Request status history retrieved successfully from trigger logs',
            'data' => $history,
        ]);
    }
}
