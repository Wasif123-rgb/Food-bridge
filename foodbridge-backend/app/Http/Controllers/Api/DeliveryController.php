<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DeliveryController extends Controller
{
    // GET: /api/deliveries
    public function index(Request $request)
    {
        $this->authorizeAdmin($request);
        $deliveries = Delivery::latest()->get();

        return response()->json([
            'success' => true,
            'message' => 'Deliveries retrieved successfully',
            'data' => $deliveries
        ]);
    }

    // POST: /api/deliveries
    public function store(Request $request)
    {
        $this->authorizeAdmin($request);
        $validated = $request->validate([
            'request_id' => 'required|exists:food_requests,id',
            'volunteer_id' => 'nullable|exists:volunteers,id',
            'pickup_time' => 'nullable|date',
            'delivered_at' => 'nullable|date',
            'delivery_status' => 'sometimes|string|max:50',
        ]);

        if (Delivery::where('request_id', $validated['request_id'])->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'This food request already has a delivery assignment.',
            ], 422);
        }

        $delivery = DB::transaction(function () use ($validated) {
            $delivery = Delivery::create($validated);

            DB::affectingStatement(
                "UPDATE food_requests SET request_status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [$validated['request_id']]
            );

            if (! empty($validated['volunteer_id'])) {
                DB::affectingStatement(
                    "UPDATE volunteers SET availability_status = 'Busy', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [$validated['volunteer_id']]
                );
            }

            return $delivery;
        });

        return response()->json([
            'success' => true,
            'message' => 'Delivery created successfully',
            'data' => $delivery
        ], 201);
    }

    // GET: /api/deliveries/{id}
    public function show(Request $request, string $id)
    {
        $this->authorizeAdmin($request);
        $delivery = Delivery::findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $delivery
        ]);
    }

    // PUT/PATCH: /api/deliveries/{id}
    public function update(Request $request, string $id)
    {
        $this->authorizeAdmin($request);
        $delivery = Delivery::findOrFail($id);

        $validated = $request->validate([
            'request_id' => 'sometimes|required|exists:food_requests,id',
            'volunteer_id' => 'nullable|exists:volunteers,id',
            'pickup_time' => 'nullable|date',
            'delivered_at' => 'nullable|date',
            'delivery_status' => 'sometimes|string|max:50',
        ]);

        $delivery->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Delivery updated successfully',
            'data' => $delivery
        ]);
    }

    // DELETE: /api/deliveries/{id}
    public function destroy(Request $request, string $id)
    {
        $this->authorizeAdmin($request);
        $delivery = Delivery::findOrFail($id);

        $delivery->delete();

        return response()->json([
            'success' => true,
            'message' => 'Delivery deleted successfully'
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Admin access only.');
    }
}
