<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\FoodDonation;
use App\Models\FoodRequest;
use App\Models\Ngo;
use App\Models\User;
use App\Models\Volunteer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VolunteerDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_volunteer_registration_creates_linked_profile(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Volunteer Person',
            'email' => 'volunteer@example.com',
            'phone' => '01700000000',
            'role' => 'volunteer',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertCreated();

        $user = User::where('email', 'volunteer@example.com')->firstOrFail();

        $this->assertDatabaseHas('volunteers', [
            'user_id' => $user->id,
            'full_name' => 'Volunteer Person',
            'availability_status' => 'Offline',
            'vehicle_type' => 'None',
        ]);
    }

    public function test_non_volunteer_cannot_access_volunteer_profile(): void
    {
        $user = User::factory()->create(['role' => 'donor', 'phone' => '01800000000']);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/volunteer/profile')
            ->assertForbidden();
    }

    public function test_volunteer_sees_only_their_assigned_deliveries(): void
    {
        $user = User::factory()->create(['role' => 'volunteer', 'phone' => '01900000000']);
        $volunteer = Volunteer::create([
            'user_id' => $user->id,
            'full_name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'availability_status' => 'Available',
            'vehicle_type' => 'Bicycle',
        ]);
        $otherVolunteer = Volunteer::create([
            'full_name' => 'Other Volunteer',
            'email' => 'other@example.com',
            'phone' => '01600000000',
            'availability_status' => 'Offline',
            'vehicle_type' => 'None',
        ]);

        $ngo = Ngo::create([
            'ngo_name' => 'Community NGO',
            'registration_no' => 'NGO-TEST-001',
            'email' => 'ngo@example.com',
            'phone' => '01500000000',
            'address' => 'Dhaka',
        ]);
        $donation = FoodDonation::create([
            'donor_id' => $this->createDonorUser(),
            'food_name' => 'Rice',
            'food_category' => 'Dry Food',
            'quantity' => 10,
            'unit' => 'kg',
            'expiry_at' => now()->addDay(),
        ]);
        $request = FoodRequest::create([
            'ngo_id' => $ngo->id,
            'donation_id' => $donation->id,
            'requested_qty' => 5,
        ]);

        $assigned = Delivery::create(['request_id' => $request->id, 'volunteer_id' => $volunteer->id]);
        Delivery::create(['request_id' => $request->id, 'volunteer_id' => $otherVolunteer->id]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/volunteer/deliveries')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.delivery_id', $assigned->id)
            ->assertJsonPath('data.0.ngo_id', $ngo->id)
            ->assertJsonPath('data.0.food_name', 'Rice');

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/volunteer/deliveries/'.$assigned->id.'/status', [
                'delivery_status' => 'cancelled',
            ])
            ->assertUnprocessable();

        $otherDelivery = Delivery::where('volunteer_id', $otherVolunteer->id)->firstOrFail();

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/volunteer/deliveries/'.$otherDelivery->id.'/status', [
                'delivery_status' => 'picked_up',
            ])
            ->assertForbidden();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/deliveries', [
                'request_id' => $request->id,
                'volunteer_id' => $volunteer->id,
            ])
            ->assertForbidden();
    }

    private function createDonorUser(): int
    {
        $user = User::factory()->create(['role' => 'donor', 'phone' => '01400000000']);

        return $user->donor()->create([
            'donor_name' => $user->name,
            'donor_type' => 'Individual',
            'email' => $user->email,
            'phone' => $user->phone,
            'address' => 'Dhaka',
        ])->id;
    }
}
