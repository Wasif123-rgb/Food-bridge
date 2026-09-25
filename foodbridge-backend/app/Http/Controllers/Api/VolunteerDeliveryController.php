<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class VolunteerDeliveryController extends Controller
{
    public function index(Request $request)
    {
        $volunteer = $this->authenticatedVolunteer($request);

        $deliveries = DB::select(
            'SELECT * FROM volunteer_delivery_details WHERE volunteer_id = ? ORDER BY created_at DESC',
            [$volunteer->id]
        );

        return response()->json([
            'success' => true,
            'data' => $deliveries,
        ]);
    }

    public function updateStatus(Request $request, string $deliveryId)
    {
        $validated = $request->validate([
            'delivery_status' => [
                'required',
                'string',
                Rule::in(['picked_up', 'in_transit', 'delivered']),
            ],
        ]);

        $volunteer = $this->authenticatedVolunteer($request);
        $delivery = DB::selectOne(
            'SELECT id, volunteer_id FROM deliveries WHERE id = ? LIMIT 1',
            [$deliveryId]
        );

        if (! $delivery) {
            return response()->json([
                'success' => false,
                'message' => 'Delivery not found.',
            ], 404);
        }

        if ((int) $delivery->volunteer_id !== (int) $volunteer->id) {
            return response()->json([
                'success' => false,
                'message' => 'You are not authorized to update this delivery.',
            ], 403);
        }

        try {
            $result = DB::select(
                'CALL update_volunteer_delivery_status(?, ?, ?)',
                [$deliveryId, $volunteer->id, $validated['delivery_status']]
            );

            $updatedDelivery = DB::selectOne(
                'SELECT * FROM volunteer_delivery_details WHERE delivery_id = ? AND volunteer_id = ? LIMIT 1',
                [$deliveryId, $volunteer->id]
            );

            return response()->json([
                'success' => true,
                'message' => $result[0]->message ?? 'Delivery status updated successfully.',
                'data' => $updatedDelivery,
            ]);
        } catch (QueryException $exception) {
            $message = $this->safeProcedureMessage($exception);

            return response()->json([
                'success' => false,
                'message' => $message,
            ], 422);
        }
    }

    private function authenticatedVolunteer(Request $request): object
    {
        abort_unless($request->user()?->role === 'volunteer', 403, 'Volunteer access only.');

        $volunteer = DB::selectOne(
            'SELECT id FROM volunteers WHERE user_id = ? LIMIT 1',
            [$request->user()->id]
        );

        abort_unless($volunteer, 404, 'Volunteer profile not found.');

        return $volunteer;
    }

    private function safeProcedureMessage(QueryException $exception): string
    {
        $knownMessages = [
            'Delivery not found.',
            'This delivery is not assigned to the authenticated volunteer.',
            'Unsupported delivery status.',
            'Invalid delivery status transition.',
        ];

        foreach ($knownMessages as $knownMessage) {
            if (str_contains($exception->getMessage(), $knownMessage)) {
                return $knownMessage;
            }
        }

        return 'Unable to update the delivery status.';
    }
}
