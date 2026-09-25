<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\FoodDonation;
use App\Models\FoodRequest;
use App\Models\Ngo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RecipientManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_ngo_can_manage_only_its_own_recipients(): void
    {
        [$userA, $ngoA] = $this->createNgo('ngo-a@example.com', 'NGO A');
        [$userB] = $this->createNgo('ngo-b@example.com', 'NGO B');

        $first = $this->actingAs($userA, 'sanctum')->postJson('/api/ngo/recipients', [
            'full_name' => 'Recipient One',
            'address' => 'Dhaka',
            'phone' => '01710000001',
            'household_size' => 4,
        ])->assertCreated()->json('data');

        $second = $this->actingAs($userA, 'sanctum')->postJson('/api/ngo/recipients', [
            'full_name' => 'Recipient Two',
            'address' => 'Dhaka',
            'phone' => '01710000002',
            'household_size' => 2,
        ])->assertCreated()->json('data');

        $this->assertSame(1, $first['recipient_no']);
        $this->assertSame(2, $second['recipient_no']);

        $this->actingAs($userA, 'sanctum')
            ->patchJson('/api/ngo/recipients/1', ['household_size' => 5])
            ->assertOk()
            ->assertJsonPath('data.household_size', 5);

        $this->actingAs($userB, 'sanctum')
            ->getJson('/api/ngo/recipients/1')
            ->assertNotFound();

        $this->actingAs($userA, 'sanctum')
            ->getJson('/api/ngo/recipients')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.ngo_id', $ngoA->id);
    }

    public function test_delivery_contract_exposes_feedback_eligibility_without_creating_feedback(): void
    {
        [$user, $ngo] = $this->createNgo('ngo@example.com', 'Community NGO');
        $recipient = $this->actingAs($user, 'sanctum')->postJson('/api/ngo/recipients', [
            'full_name' => 'Recipient', 'address' => 'Dhaka',
            'phone' => '01710000000', 'household_size' => 3,
        ])->json('data');

        $donorUser = User::factory()->create(['role' => 'donor', 'phone' => '01810000000']);
        $donor = $donorUser->donor()->create([
            'donor_name' => 'Donor', 'donor_type' => 'Individual',
            'email' => $donorUser->email, 'phone' => $donorUser->phone, 'address' => 'Dhaka',
        ]);
        $donation = FoodDonation::create([
            'donor_id' => $donor->id, 'food_name' => 'Rice', 'food_category' => 'Dry Food',
            'quantity' => 10, 'unit' => 'kg', 'expiry_at' => now()->addDay(),
        ]);
        $foodRequest = FoodRequest::create([
            'ngo_id' => $ngo->id, 'donation_id' => $donation->id, 'requested_qty' => 5,
        ]);
        $delivery = Delivery::create([
            'request_id' => $foodRequest->id,
            'recipient_id' => $recipient['recipient_id'],
            'delivery_status' => 'delivered',
            'delivered_at' => now(),
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/ngo/recipients/1/deliveries')
            ->assertOk()
            ->assertJsonPath('data.0.delivery_id', $delivery->id)
            ->assertJsonPath('data.0.recipient_id', $recipient['recipient_id'])
            ->assertJsonPath('data.0.can_submit_feedback', 1);

        $this->assertDatabaseCount('feedback', 0);
    }

    public function test_recipient_selected_ngo_relationship_is_isolated_between_two_ngos(): void
    {
        [$ngoUserA, $ngoA] = $this->createNgo('workflow-ngo-a@example.com', 'Workflow NGO A');
        [$ngoUserB, $ngoB] = $this->createNgo('workflow-ngo-b@example.com', 'Workflow NGO B');
        $ngoA->update(['is_verified' => true]);
        $ngoB->update(['is_verified' => true]);

        $recipientA = User::factory()->create(['role' => 'recipient', 'name' => 'Recipient A']);
        $recipientB = User::factory()->create(['role' => 'recipient', 'name' => 'Recipient B']);

        $this->actingAs($recipientA, 'sanctum')->postJson('/api/recipient/profile', [
            'ngo_id' => $ngoA->id, 'full_name' => 'Recipient A',
            'phone' => '01720000001', 'address' => 'Area A', 'household_size' => 2,
        ])->assertCreated();

        $this->actingAs($recipientB, 'sanctum')->postJson('/api/recipient/profile', [
            'ngo_id' => $ngoB->id, 'full_name' => 'Recipient B',
            'phone' => '01720000002', 'address' => 'Area B', 'household_size' => 3,
        ])->assertCreated();

        $this->actingAs($ngoUserA, 'sanctum')->getJson('/api/ngo/recipients')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.full_name', 'Recipient A')
            ->assertJsonMissing(['full_name' => 'Recipient B']);

        $this->actingAs($ngoUserB, 'sanctum')->getJson('/api/ngo/recipients')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.full_name', 'Recipient B')
            ->assertJsonMissing(['full_name' => 'Recipient A']);

        $this->actingAs($recipientA, 'sanctum')->getJson('/api/recipient/profile')
            ->assertOk()->assertJsonPath('data.user_id', $recipientA->id)
            ->assertJsonPath('data.ngo_id', $ngoA->id)
            ->assertJsonMissing(['user_id' => $recipientB->id]);

        $this->actingAs($recipientB, 'sanctum')->getJson('/api/recipient/profile')
            ->assertOk()->assertJsonPath('data.user_id', $recipientB->id)
            ->assertJsonPath('data.ngo_id', $ngoB->id)
            ->assertJsonMissing(['user_id' => $recipientA->id]);
    }

    private function createNgo(string $email, string $name): array
    {
        $user = User::factory()->create(['email' => $email, 'role' => 'ngo', 'phone' => fake()->unique()->numerify('01#########')]);
        $ngo = Ngo::create([
            'ngo_name' => $name,
            'registration_no' => fake()->unique()->numerify('NGO-######'),
            'email' => $email,
            'phone' => $user->phone,
            'address' => 'Dhaka',
        ]);

        return [$user, $ngo];
    }
}
