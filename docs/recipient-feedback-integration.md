# Recipient → Delivery → Feedback integration

FoodBridge does not authenticate recipients directly. An authenticated NGO manages its recipients, and every recipient is identified by:

- `recipient_id`: the existing database surrogate key used by `deliveries.recipient_id`.
- `(ngo_id, recipient_no)`: the ERD-compatible logical identity shown to the NGO.

## Obtaining eligible deliveries

Call `GET /api/ngo/recipients/{recipientNo}/deliveries` with the NGO's Sanctum bearer token. The backend derives the NGO from the authenticated user and returns only deliveries whose `recipient_id` belongs to that NGO and recipient number.

Each delivery item provides stable identifiers and eligibility data, including:

```json
{
  "ngo_id": 1,
  "recipient_no": 1,
  "recipient_id": 1,
  "delivery_id": 10,
  "delivery_status": "delivered",
  "delivered_at": "2026-09-25 21:00:00",
  "can_submit_feedback": 1
}
```

It also includes the request, volunteer, food, quantity, and pickup fields exposed by `recipient_delivery_details`.

## Future feedback authorization

Feedback continues to belong to a delivery through `feedback.delivery_id`. Do not add `recipient_id` to feedback merely for convenience. A future feedback endpoint should:

1. Authenticate the NGO managing the recipient.
2. Resolve the NGO-owned recipient using `(ngo_id, recipient_no)`.
3. Confirm the supplied `delivery_id` belongs to that recipient through `deliveries.recipient_id`.
4. Require the delivery status to be `delivered` and `delivered_at` to be present.
5. Reject a second submission when feedback already exists for the delivery.
6. Insert feedback using only the validated `delivery_id`.

`can_submit_feedback` is true only when the delivery status is delivered and no feedback row currently exists for that delivery. The server must repeat these checks when feedback is eventually submitted; the UI flag alone is not authorization.

No Feedback controller, model, migration, API route, or frontend file was modified as part of the Recipient feature.
