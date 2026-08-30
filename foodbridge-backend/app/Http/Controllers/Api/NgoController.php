<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ngo;
use App\Models\FoodDonation;
use App\Models\FoodRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NgoController extends Controller
{
    /*
    | NGO CRUD
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
            'ngo_name' =>
                'sometimes|required|string|max:255|unique:ngos,ngo_name,' . $ngo->id,

            'registration_no' =>
                'sometimes|required|string|max:255|unique:ngos,registration_no,' . $ngo->id,

            'email' =>
                'sometimes|required|email|unique:ngos,email,' . $ngo->id,

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
     Logged-in NGO Profile
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
    | Available Food Donations
    |--------------------------------------------------------------------------
    */

    // GET: /api/ngo/available-donations
   // GET: /api/ngo/available-donations
// JOIN: food_donations + donors + food_requests
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

    /*
     * DATABASE JOIN
     *
     * food_donations
     *      JOIN donors
     *      LEFT JOIN food_requests
     *
     * LEFT JOIN is used for food_requests because a donation
     * should still appear even when nobody has requested it yet.
     */
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
            ->whereIn(
                'food_requests.request_status',
                ['pending', 'approved']
            );
        })
        ->where(
            'food_donations.availability_status',
            'available'
        )
        ->where(
            'food_donations.donation_status',
            'active'
        )
        ->where(
            'food_donations.expiry_at',
            '>',
            now()
        )
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
        ->orderBy(
            'food_donations.expiry_at'
        )
        ->get();

    /*
     * Keep the API response compatible with NgoPage.tsx.
     */
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
            'availability_status' =>
                $row->availability_status,
            'donation_status' =>
                $row->donation_status,

            'reserved_qty' =>
                $row->reserved_qty,

            'remaining_qty' =>
                $row->remaining_qty,

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
        'message' =>
            'Available food donations retrieved successfully using database joins',
        'data' => $donations,
    ]);
}


    /*
    |--------------------------------------------------------------------------
    | NGO Food Requests
    |--------------------------------------------------------------------------
    */

    // GET: /api/ngo/requests
    // GET: /api/ngo/requests
// JOIN: food_requests + ngos + food_donations + donors
public function myRequests(Request $request)
{
    $user = $request->user();

    if (!$user || $user->role !== 'ngo') {
        return response()->json([
            'success' => false,
            'message' =>
                'Only NGO users can view food requests.',
        ], 403);
    }

    $ngo = Ngo::where(
        'email',
        $user->email
    )->first();

    if (!$ngo) {
        return response()->json([
            'success' => false,
            'message' => 'NGO profile not found.',
        ], 404);
    }

    /*
     * DATABASE INNER JOIN
     *
     * food_requests
     *      JOIN ngos
     *      JOIN food_donations
     *      JOIN donors
     */
    $rows = DB::table('food_requests')
        ->join(
            'ngos',
            'food_requests.ngo_id',
            '=',
            'ngos.id'
        )
        ->join(
            'food_donations',
            'food_requests.donation_id',
            '=',
            'food_donations.id'
        )
        ->join(
            'donors',
            'food_donations.donor_id',
            '=',
            'donors.id'
        )
        ->where(
            'food_requests.ngo_id',
            $ngo->id
        )
        ->select(
            'food_requests.id',
            'food_requests.ngo_id',
            'food_requests.donation_id',
            'food_requests.requested_qty',
            'food_requests.requested_at',
            'food_requests.request_status',

            'ngos.ngo_name',

            'food_donations.food_name',
            'food_donations.food_category',
            'food_donations.quantity as donation_quantity',
            'food_donations.unit',
            'food_donations.prepared_at',
            'food_donations.expiry_at',

            'donors.id as donor_id',
            'donors.donor_name',
            'donors.donor_type',
            'donors.email as donor_email',
            'donors.phone as donor_phone',
            'donors.address as donor_address'
        )
        ->orderByDesc(
            'food_requests.requested_at'
        )
        ->get();

    /*
     * Convert flat JOIN output into the same nested
     * structure expected by the React NGO dashboard.
     */
    $foodRequests = $rows->map(function ($row) {
        return [
            'id' => $row->id,
            'ngo_id' => $row->ngo_id,
            'ngo_name' => $row->ngo_name,
            'donation_id' =>
                $row->donation_id,
            'requested_qty' =>
                $row->requested_qty,
            'requested_at' =>
                $row->requested_at,
            'request_status' =>
                $row->request_status,

            'donation' => [
                'id' => $row->donation_id,
                'food_name' =>
                    $row->food_name,
                'food_category' =>
                    $row->food_category,
                'quantity' =>
                    $row->donation_quantity,
                'unit' => $row->unit,
                'prepared_at' =>
                    $row->prepared_at,
                'expiry_at' =>
                    $row->expiry_at,

                'donor' => [
                    'id' => $row->donor_id,
                    'donor_name' =>
                        $row->donor_name,
                    'donor_type' =>
                        $row->donor_type,
                    'email' =>
                        $row->donor_email,
                    'phone' =>
                        $row->donor_phone,
                    'address' =>
                        $row->donor_address,
                ],
            ],
        ];
    });

    return response()->json([
        'success' => true,
        'message' =>
            'Your food requests retrieved successfully using database joins',
        'data' => $foodRequests,
    ]);
}
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
                'message' =>
                    'Please complete your NGO profile first.',
            ], 404);
        }

        $validated = $request->validate([
            'donation_id' =>
                'required|exists:food_donations,id',

            'requested_qty' =>
                'required|numeric|min:0.01',
        ]);

        $donation = FoodDonation::where(
            'id',
            $validated['donation_id']
        )
            ->where('availability_status', 'available')
            ->where('donation_status', 'active')
            ->where('expiry_at', '>', now())
            ->first();

        if (!$donation) {
            return response()->json([
                'success' => false,
                'message' =>
                    'This donation is no longer available.',
            ], 422);
        }

        /*
         * Prevent the same NGO from creating another active
         * request for the same donation.
         */
        $alreadyRequested = FoodRequest::where(
            'ngo_id',
            $ngo->id
        )
            ->where('donation_id', $donation->id)
            ->whereIn(
                'request_status',
                ['pending', 'approved']
            )
            ->exists();

        if ($alreadyRequested) {
            return response()->json([
                'success' => false,
                'message' =>
                    'You already have an active request for this donation.',
            ], 422);
        }

        /*
         * Calculate how much food is still available.
         */
        $reservedQuantity = FoodRequest::where(
            'donation_id',
            $donation->id
        )
            ->whereIn(
                'request_status',
                ['pending', 'approved']
            )
            ->sum('requested_qty');

        $remainingQuantity = max(
            0,
            (float) $donation->quantity -
                (float) $reservedQuantity
        );

        if (
            (float) $validated['requested_qty'] >
            $remainingQuantity
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Requested quantity is greater than the available quantity.',
                'remaining_qty' => $remainingQuantity,
            ], 422);
        }

        /*
         * NGO ID and request status are assigned by backend.
         * NGO user does not control these values.
         */
        $foodRequest = FoodRequest::create([
            'ngo_id' => $ngo->id,
            'donation_id' => $donation->id,
            'requested_qty' =>
                $validated['requested_qty'],
            'requested_at' => now(),
            'request_status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'Food request submitted successfully',
            'data' =>
                $foodRequest->load('donation.donor'),
        ], 201);
    }
}