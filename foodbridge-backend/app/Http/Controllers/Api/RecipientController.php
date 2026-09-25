<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class RecipientController extends Controller
{
    public function index(Request $request)
    {
        $ngo = $this->authenticatedNgo($request);
        $recipients = DB::select(<<<'SQL'
            SELECT r.id AS recipient_id, r.ngo_id, r.recipient_no,
                r.full_name, r.address, r.phone, r.household_size,
                n.ngo_name, COUNT(d.id) AS delivery_count,
                (SELECT latest.delivery_status FROM deliveries latest
                 WHERE latest.recipient_id = r.id
                 ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1) AS latest_delivery_status
            FROM recipients r
            INNER JOIN ngos n ON n.id = r.ngo_id
            LEFT JOIN deliveries d ON d.recipient_id = r.id
            WHERE r.ngo_id = ?
            GROUP BY r.id, r.ngo_id, r.recipient_no, r.full_name,
                r.address, r.phone, r.household_size, n.ngo_name
            ORDER BY r.recipient_no ASC
        SQL, [$ngo->id]);

        return response()->json(['success' => true, 'data' => $recipients]);
    }

    public function store(Request $request)
    {
        $ngo = $this->authenticatedNgo($request);
        $validated = $this->validateRecipient($request);

        $recipient = DB::transaction(function () use ($ngo, $validated) {
            $lockSql = DB::getDriverName() === 'mysql'
                ? 'SELECT id FROM ngos WHERE id = ? FOR UPDATE'
                : 'SELECT id FROM ngos WHERE id = ?';
            DB::selectOne($lockSql, [$ngo->id]);
            $nextNumber = DB::selectOne(
                'SELECT COALESCE(MAX(recipient_no), 0) + 1 AS next_number FROM recipients WHERE ngo_id = ?',
                [$ngo->id]
            )->next_number;

            DB::insert(
                'INSERT INTO recipients (ngo_id, recipient_no, full_name, address, phone, household_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                [$ngo->id, $nextNumber, $validated['full_name'], $validated['address'], $validated['phone'], $validated['household_size']]
            );

            return DB::selectOne(
                'SELECT id AS recipient_id, ngo_id, recipient_no, full_name, address, phone, household_size FROM recipients WHERE ngo_id = ? AND recipient_no = ?',
                [$ngo->id, $nextNumber]
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'Recipient registered successfully.',
            'data' => $recipient,
        ], 201);
    }

    public function show(Request $request, string $recipientNo)
    {
        $ngo = $this->authenticatedNgo($request);

        return response()->json([
            'success' => true,
            'data' => $this->ownedRecipient($ngo->id, $recipientNo),
        ]);
    }

    public function update(Request $request, string $recipientNo)
    {
        $ngo = $this->authenticatedNgo($request);
        $recipient = $this->ownedRecipient($ngo->id, $recipientNo);
        $validated = $this->validateRecipient($request, true);

        DB::affectingStatement(
            'UPDATE recipients SET full_name = ?, address = ?, phone = ?, household_size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ngo_id = ?',
            [
                $validated['full_name'] ?? $recipient->full_name,
                $validated['address'] ?? $recipient->address,
                $validated['phone'] ?? $recipient->phone,
                $validated['household_size'] ?? $recipient->household_size,
                $recipient->recipient_id,
                $ngo->id,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Recipient updated successfully.',
            'data' => $this->ownedRecipient($ngo->id, $recipientNo),
        ]);
    }

    public function deliveries(Request $request, string $recipientNo)
    {
        $ngo = $this->authenticatedNgo($request);
        $this->ownedRecipient($ngo->id, $recipientNo);
        $deliveries = DB::select(
            'SELECT * FROM recipient_delivery_details WHERE ngo_id = ? AND recipient_no = ? ORDER BY created_at DESC',
            [$ngo->id, $recipientNo]
        );

        return response()->json(['success' => true, 'data' => $deliveries]);
    }

    public function currentProfile(Request $request)
    {
        $this->authorizeRecipient($request);

        return response()->json([
            'success' => true,
            'data' => $this->profileForUser($request->user()->id),
            'user' => [
                'name' => $request->user()->name,
                'phone' => $request->user()->phone,
            ],
        ]);
    }

    public function verifiedNgos(Request $request)
    {
        $this->authorizeRecipient($request);

        return response()->json([
            'success' => true,
            'data' => DB::select(
                'SELECT id, ngo_name, address FROM ngos WHERE is_verified = 1 ORDER BY ngo_name ASC'
            ),
        ]);
    }

    public function createCurrentProfile(Request $request)
    {
        $this->authorizeRecipient($request);
        $validated = $request->validate([
            'ngo_id' => ['required', 'integer'],
            'full_name' => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:2000'],
            'phone' => ['required', 'string', 'max:20'],
            'household_size' => ['required', 'integer', 'min:1'],
        ]);

        DB::beginTransaction();
        try {
            $lock = DB::getDriverName() === 'mysql' ? ' FOR UPDATE' : '';
            DB::selectOne('SELECT id FROM users WHERE id = ? LIMIT 1'.$lock, [$request->user()->id]);
            if (DB::selectOne('SELECT id FROM recipients WHERE user_id = ? LIMIT 1'.$lock, [$request->user()->id])) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'A recipient profile already exists for this account.'], 409);
            }

            $ngo = DB::selectOne(
                'SELECT id FROM ngos WHERE id = ? AND is_verified = 1 LIMIT 1'.$lock,
                [$validated['ngo_id']]
            );
            if (! $ngo) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Please select a valid verified NGO.'], 422);
            }

            $nextNumber = DB::selectOne(
                'SELECT COALESCE(MAX(recipient_no), 0) + 1 AS next_number FROM recipients WHERE ngo_id = ?',
                [$ngo->id]
            )->next_number;

            DB::insert(
                'INSERT INTO recipients (user_id, ngo_id, recipient_no, full_name, phone, address, household_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
                [$request->user()->id, $ngo->id, $nextNumber, $validated['full_name'], $validated['phone'], $validated['address'], $validated['household_size']]
            );
            DB::commit();
        } catch (Throwable $exception) {
            DB::rollBack();
            report($exception);
            return response()->json(['success' => false, 'message' => 'Unable to create the recipient profile.'], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Recipient profile completed successfully.',
            'data' => $this->profileForUser($request->user()->id),
        ], 201);
    }

    public function updateCurrentProfile(Request $request)
    {
        $this->authorizeRecipient($request);
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:2000'],
            'phone' => ['required', 'string', 'max:20'],
            'household_size' => ['required', 'integer', 'min:1'],
        ]);

        $updated = DB::affectingStatement(
            'UPDATE recipients SET full_name = ?, phone = ?, address = ?, household_size = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
            [$validated['full_name'], $validated['phone'], $validated['address'], $validated['household_size'], $request->user()->id]
        );
        if ($updated === 0 && ! $this->profileForUser($request->user()->id)) {
            return response()->json(['success' => false, 'message' => 'Recipient profile not found.'], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Recipient profile updated successfully.',
            'data' => $this->profileForUser($request->user()->id),
        ]);
    }

    public function currentDeliveries(Request $request)
    {
        $this->authorizeRecipient($request);
        $profile = $this->profileForUser($request->user()->id);
        if (! $profile) {
            return response()->json(['success' => false, 'message' => 'Complete your recipient profile first.'], 422);
        }

        return response()->json([
            'success' => true,
            'data' => DB::select(
                'SELECT * FROM recipient_delivery_details WHERE recipient_id = ? ORDER BY created_at DESC',
                [$profile->recipient_id]
            ),
        ]);
    }

    private function authenticatedNgo(Request $request): object
    {
        abort_unless($request->user()?->role === 'ngo', 403, 'NGO access only.');
        $ngo = DB::selectOne('SELECT id, ngo_name FROM ngos WHERE email = ? LIMIT 1', [$request->user()->email]);
        abort_unless($ngo, 404, 'NGO profile not found.');

        return $ngo;
    }

    private function authorizeRecipient(Request $request): void
    {
        abort_unless($request->user()?->role === 'recipient', 403, 'Recipient access only.');
    }

    private function profileForUser(int $userId): ?object
    {
        return DB::selectOne(<<<'SQL'
            SELECT r.id AS recipient_id, r.user_id, r.ngo_id, r.recipient_no,
                r.full_name, r.address, r.phone, r.household_size, n.ngo_name,
                COUNT(d.id) AS delivery_count,
                (SELECT latest.delivery_status FROM deliveries latest
                 WHERE latest.recipient_id = r.id
                 ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1) AS latest_delivery_status
            FROM recipients r
            INNER JOIN ngos n ON n.id = r.ngo_id
            LEFT JOIN deliveries d ON d.recipient_id = r.id
            WHERE r.user_id = ?
            GROUP BY r.id, r.user_id, r.ngo_id, r.recipient_no, r.full_name,
                r.address, r.phone, r.household_size, n.ngo_name
            LIMIT 1
        SQL, [$userId]);
    }

    private function ownedRecipient(int $ngoId, string $recipientNo): object
    {
        $recipient = DB::selectOne(
            'SELECT id AS recipient_id, ngo_id, recipient_no, full_name, address, phone, household_size FROM recipients WHERE ngo_id = ? AND recipient_no = ? LIMIT 1',
            [$ngoId, $recipientNo]
        );
        abort_unless($recipient, 404, 'Recipient not found.');

        return $recipient;
    }

    private function validateRecipient(Request $request, bool $partial = false): array
    {
        $presence = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'full_name' => [$presence, 'string', 'max:255'],
            'address' => [$presence, 'string', 'max:2000'],
            'phone' => [$presence, 'string', 'max:20'],
            'household_size' => [$presence, 'integer', 'min:1'],
        ]);
    }
}
