<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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
            'volunteer_id' => 'required|exists:volunteers,id',
            'recipient_id' => 'required|exists:recipients,id',
            'pickup_time' => 'nullable|date',
            'delivered_at' => 'nullable|date',
            'delivery_status' => [
                'sometimes',
                'string',
                'max:50',
                Rule::in(['pending']),
            ],
        ]);

        $delivery = DB::transaction(function () use ($validated) {

            /*
             * Lock the volunteer row while checking availability.
             * This prevents two simultaneous admin requests from
             * assigning the same volunteer.
             */
            $volunteer = DB::table('volunteers')
                ->where('id', $validated['volunteer_id'])
                ->lockForUpdate()
                ->first();

            if (! $volunteer) {
                abort(422, 'Selected volunteer was not found.');
            }

            if (
                strcasecmp(
                    (string) $volunteer->availability_status,
                    'Available'
                ) !== 0
            ) {
                abort(
                    422,
                    'The selected volunteer is not currently available.'
                );
            }

            /*
             * Lock the food request while checking whether it already
             * has a delivery assignment.
             */
            $foodRequest = DB::table('food_requests')
                ->where('id', $validated['request_id'])
                ->lockForUpdate()
                ->first();

            if (! $foodRequest) {
                abort(422, 'Food request was not found.');
            }

            if (
                Delivery::where(
                    'request_id',
                    $validated['request_id']
                )->exists()
            ) {
                abort(
                    422,
                    'This food request already has a delivery assignment.'
                );
            }

            /*
             * The recipient must belong to the same NGO that created
             * the food request.
             */
            if (
                ! $this->recipientMatchesRequest(
                    (int) $validated['recipient_id'],
                    (int) $validated['request_id']
                )
            ) {
                abort(
                    422,
                    'The recipient must belong to the NGO that created the food request.'
                );
            }

            $deliveryData = [
                'request_id' => $validated['request_id'],
                'volunteer_id' => $validated['volunteer_id'],
                'recipient_id' => $validated['recipient_id'],
                'pickup_time' => $validated['pickup_time'] ?? null,
                'delivered_at' => $validated['delivered_at'] ?? null,
                'delivery_status' =>
                    $validated['delivery_status'] ?? 'pending',
            ];

            $delivery = Delivery::create($deliveryData);

            /*
             * Creating the delivery means the admin has approved/
             * assigned the food request.
             */
            DB::table('food_requests')
                ->where('id', $validated['request_id'])
                ->update([
                    'request_status' => 'approved',
                    'updated_at' => now(),
                ]);

            /*
             * The volunteer is no longer available for another
             * delivery until this delivery is completed.
             */
            DB::table('volunteers')
                ->where('id', $validated['volunteer_id'])
                ->update([
                    'availability_status' => 'Busy',
                    'updated_at' => now(),
                ]);

            return $delivery;
        });

        return response()->json([
            'success' => true,
            'message' => 'Delivery assigned successfully',
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
            'recipient_id' => 'nullable|exists:recipients,id',
            'pickup_time' => 'nullable|date',
            'delivered_at' => 'nullable|date',
            'delivery_status' => [
                'sometimes',
                'string',
                'max:50',
                Rule::in([
                    'pending',
                    'picked_up',
                    'in_transit',
                    'delivered',
                ]),
            ],
        ]);

        $requestId = (int) (
            $validated['request_id'] ?? $delivery->request_id
        );

        $recipientId =
            $validated['recipient_id'] ??
            $delivery->recipient_id;

        if (
            $recipientId &&
            ! $this->recipientMatchesRequest(
                (int) $recipientId,
                $requestId
            )
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'The recipient must belong to the NGO that created the food request.',
            ], 422);
        }

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
        abort_unless(
            $request->user()?->role === 'admin',
            403,
            'Admin access only.'
        );
    }

    private function recipientMatchesRequest(
        int $recipientId,
        int $requestId
    ): bool {
        return DB::selectOne(<<<'SQL'
            SELECT 1 AS matches_request
            FROM recipients r
            INNER JOIN food_requests fr
                ON fr.ngo_id = r.ngo_id
            WHERE r.id = ?
              AND fr.id = ?
            LIMIT 1
        SQL, [$recipientId, $requestId]) !== null;
    }
}