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

        /*
         * Recipient accounts can only see feedback belonging
         * to their own deliveries.
         */
        if ($user?->role === 'recipient') {
            $recipientId = DB::table('recipients')
                ->where('user_id', $user->id)
                ->value('id');

            if (! $recipientId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Recipient profile not found.',
                ], 404);
            }

            $feedback = Feedback::query()
                ->whereHas('delivery', function ($query) use ($recipientId) {
                    $query->where('recipient_id', $recipientId);
                })
                ->with('delivery')
                ->latest()
                ->get();

            return response()->json([
                'success' => true,
                'message' => 'Feedback retrieved successfully.',
                'data' => $feedback,
            ]);
        }

        /*
         * Admin and other authenticated users can see all feedback.
         */
        $feedback = Feedback::with('delivery')
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Feedback retrieved successfully.',
            'data' => $feedback,
        ]);
    }

    public function store(Request $request)
    {
        /*
         * Only recipients can submit feedback.
         */
        abort_unless(
            $request->user()?->role === 'recipient',
            403,
            'Recipient access only.'
        );

        /*
         * Validate only the values the recipient is
         * actually allowed to submit.
         */
        $validated = $request->validate([
            'delivery_id' => 'required|integer|exists:deliveries,id',
            'rating' => 'required|integer|min:1|max:5',
            'comments' => 'nullable|string|max:5000',
        ]);

        $user = $request->user();

        /*
         * Find the recipient profile belonging to the
         * authenticated user.
         */
        $recipient = DB::table('recipients')
            ->where('user_id', $user->id)
            ->first();

        if (! $recipient) {
            return response()->json([
                'success' => false,
                'message' => 'Recipient profile not found.',
            ], 404);
        }

        /*
         * Find the delivery and make sure it belongs
         * to the authenticated recipient.
         */
        $delivery = DB::table('deliveries')
            ->where('id', $validated['delivery_id'])
            ->where('recipient_id', $recipient->id)
            ->first();

        if (! $delivery) {
            return response()->json([
                'success' => false,
                'message' => 'You are not authorized to give feedback for this delivery.',
            ], 403);
        }

        /*
         * Feedback is only allowed after the delivery
         * has reached the final "delivered" status.
         */
        if ($delivery->delivery_status !== 'delivered') {
            return response()->json([
                'success' => false,
                'message' => 'Feedback can only be submitted after the delivery is completed.',
            ], 422);
        }

        /*
         * Only one feedback record is allowed per delivery.
         */
        $existingFeedback = Feedback::where(
            'delivery_id',
            $validated['delivery_id']
        )->first();

        if ($existingFeedback) {
            return response()->json([
                'success' => false,
                'message' => 'Feedback has already been submitted for this delivery.',
            ], 422);
        }

        /*
         * submitted_by_type is controlled by the backend.
         * The client cannot choose another value.
         */
        $feedback = Feedback::create([
            'delivery_id' => $validated['delivery_id'],
            'rating' => $validated['rating'],
            'comments' => $validated['comments'] ?? null,
            'submitted_at' => now(),
            'submitted_by_type' => 'recipient',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Feedback submitted successfully.',
            'data' => $feedback->fresh(),
        ], 201);
    }

    public function show(Request $request, Feedback $feedback)
    {
        $this->authorizeFeedbackAccess($request, $feedback);

        return response()->json([
            'success' => true,
            'message' => 'Feedback retrieved successfully.',
            'data' => $feedback->load('delivery'),
        ]);
    }

    public function update(Request $request, Feedback $feedback)
    {
        $this->authorizeFeedbackAccess($request, $feedback);

        $validated = $request->validate([
            'rating' => 'sometimes|required|integer|min:1|max:5',
            'comments' => 'nullable|string|max:5000',
        ]);

        $feedback->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Feedback updated successfully.',
            'data' => $feedback->fresh(),
        ]);
    }

    public function destroy(Request $request, Feedback $feedback)
    {
        $this->authorizeFeedbackAccess($request, $feedback);

        $feedback->delete();

        return response()->json([
            'success' => true,
            'message' => 'Feedback deleted successfully.',
        ]);
    }

    private function authorizeFeedbackAccess(
        Request $request,
        Feedback $feedback
    ): void {
        $user = $request->user();

        /*
         * Admin can access any feedback.
         */
        if ($user?->role === 'admin') {
            return;
        }

        /*
         * All non-admin access must be from a recipient.
         */
        if ($user?->role !== 'recipient') {
            abort(
                403,
                'You are not authorized to access this feedback.'
            );
        }

        /*
         * Find the authenticated recipient profile.
         */
        $recipientId = DB::table('recipients')
            ->where('user_id', $user->id)
            ->value('id');

        if (! $recipientId) {
            abort(
                403,
                'Recipient profile not found.'
            );
        }

        /*
         * Load the delivery associated with this feedback.
         */
        $delivery = $feedback->delivery;

        /*
         * Make sure the feedback belongs to the
         * authenticated recipient.
         */
        abort_unless(
            $delivery &&
            (int) $delivery->recipient_id === (int) $recipientId,
            403,
            'You are not authorized to access this feedback.'
        );
    }
}