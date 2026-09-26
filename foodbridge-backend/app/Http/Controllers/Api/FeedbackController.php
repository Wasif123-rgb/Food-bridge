<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FeedbackController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'admin') {
            return response()->json([
                'success' => true,
                'data' => Feedback::latest()->get(),
            ]);
        }

        $deliveryIds = $this->authorizedDeliveryIds($user);

        return response()->json([
            'success' => true,
            'data' => Feedback::whereIn('delivery_id', $deliveryIds)
                ->latest()
                ->get(),
        ]);
    }

    public function delivery(Request $request, int $deliveryId)
    {
        $user = $request->user();

        $delivery = DB::table('recipient_delivery_details')
            ->where('delivery_id', $deliveryId)
            ->first();

        abort_unless($delivery, 404, 'Delivery not found.');

        abort_unless(
            in_array(
                $deliveryId,
                $this->authorizedDeliveryIds($user)->toArray()
            ),
            403,
            'You are not authorized to access this delivery.'
        );

        return response()->json([
            'success' => true,
            'data' => $delivery,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        abort_unless(
            in_array($user->role, ['ngo', 'recipient']),
            403,
            'Only NGO and Recipient users can submit feedback.'
        );

        $data = $request->validate([
            'delivery_id' => 'required|integer',
            'rating' => 'required|integer|min:1|max:5',
            'comments' => 'nullable|string|max:5000',
        ]);

        $delivery = DB::table('deliveries')
            ->where('id', $data['delivery_id'])
            ->first();

        abort_unless($delivery, 404, 'Delivery not found.');

        abort_unless(
            strtolower($delivery->delivery_status) === 'delivered',
            422,
            'Feedback can only be submitted after delivery.'
        );

        abort_unless(
            $this->authorizedDeliveryIds($user)
                ->contains($delivery->id),
            403,
            'You are not authorized to submit feedback for this delivery.'
        );

        abort_if(
            Feedback::where('delivery_id', $delivery->id)->exists(),
            422,
            'Feedback has already been submitted for this delivery.'
        );

        $feedback = Feedback::create([
            'delivery_id' => $delivery->id,
            'rating' => $data['rating'],
            'comments' => $data['comments'] ?? null,
            'submitted_by_type' => $user->role,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Feedback submitted successfully.',
            'data' => $feedback,
        ], 201);
    }

    public function show(Request $request, Feedback $feedback)
    {
        $this->authorizeFeedback($request, $feedback);

        return response()->json([
            'success' => true,
            'data' => $feedback,
        ]);
    }

    public function update(
        Request $request,
        Feedback $feedback
    ) {
        $this->authorizeFeedback($request, $feedback);

        $data = $request->validate([
            'rating' => 'sometimes|integer|min:1|max:5',
            'comments' => 'nullable|string|max:5000',
        ]);

        $feedback->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Feedback updated successfully.',
            'data' => $feedback->fresh(),
        ]);
    }

    public function destroy(
        Request $request,
        Feedback $feedback
    ) {
        $this->authorizeFeedback($request, $feedback);

        $feedback->delete();

        return response()->json([
            'success' => true,
            'message' => 'Feedback deleted successfully.',
        ]);
    }

    private function authorizedDeliveryIds($user)
    {
        if ($user->role === 'recipient') {
            $recipientId = DB::table('recipients')
                ->where('user_id', $user->id)
                ->value('id');

            abort_unless(
                $recipientId,
                404,
                'Recipient profile not found.'
            );

            return DB::table('deliveries')
                ->where('recipient_id', $recipientId)
                ->pluck('id');
        }

        if ($user->role === 'ngo') {
            $ngoId = DB::table('ngos')
                ->where('email', $user->email)
                ->value('id');

            abort_unless(
                $ngoId,
                404,
                'NGO profile not found.'
            );

            return DB::table('deliveries')
                ->join(
                    'recipients',
                    'recipients.id',
                    '=',
                    'deliveries.recipient_id'
                )
                ->where('recipients.ngo_id', $ngoId)
                ->pluck('deliveries.id');
        }

        abort(
            403,
            'You are not authorized to access feedback.'
        );
    }

    private function authorizeFeedback(
        Request $request,
        Feedback $feedback
    ) {
        if ($request->user()->role === 'admin') {
            return;
        }

        abort_unless(
            $this->authorizedDeliveryIds($request->user())
                ->contains($feedback->delivery_id),
            403,
            'You are not authorized to access this feedback.'
        );
    }
}