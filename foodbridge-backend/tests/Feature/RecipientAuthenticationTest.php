<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Ngo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RecipientAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_recipient_signup_uses_named_role_hashes_password_and_returns_token(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Recipient User',
            'email' => 'recipient@example.com',
            'phone' => '01700000009',
            'role' => 'recipient',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.role', 'recipient')
            ->assertJsonStructure(['token', 'user' => ['id', 'role']]);

        $user = User::where('email', 'recipient@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('password', $user->password));
        $this->assertDatabaseHas('roles', ['id' => $user->role_id, 'name' => 'recipient']);
        $this->assertDatabaseCount('recipients', 0);
    }

    public function test_existing_recipient_login_returns_same_role_and_token_shape(): void
    {
        $user = User::factory()->create([
            'email' => 'recipient-login@example.com',
            'role' => 'recipient',
            'password' => 'password',
        ]);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()
            ->assertJsonPath('user.role', 'recipient')
            ->assertJsonStructure(['token', 'user' => ['id', 'role']]);
    }

    public function test_recipient_can_create_and_update_only_their_own_profile(): void
    {
        $user = User::factory()->create([
            'name' => 'Recipient User',
            'phone' => '01700000010',
            'role' => 'recipient',
        ]);
        $otherUser = User::factory()->create(['role' => 'recipient']);
        $ngo = Ngo::create([
            'ngo_name' => 'Verified NGO',
            'registration_no' => 'NGO-PROFILE-001',
            'email' => 'verified-ngo@example.com',
            'phone' => '01800000010',
            'address' => 'Dhaka',
            'is_verified' => true,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/recipient/profile')
            ->assertOk()
            ->assertJsonPath('data', null)
            ->assertJsonPath('user.name', 'Recipient User');

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/recipient/profile', [
                'ngo_id' => $ngo->id,
                'user_id' => $otherUser->id,
                'full_name' => 'Recipient User',
                'phone' => '01700000010',
                'address' => 'Dhaka',
                'household_size' => 4,
            ])->assertCreated()
            ->assertJsonPath('data.user_id', $user->id)
            ->assertJsonPath('data.recipient_no', 1);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/recipient/profile', [
                'ngo_id' => $ngo->id,
                'full_name' => 'Duplicate',
                'phone' => '01700000010',
                'address' => 'Dhaka',
                'household_size' => 4,
            ])->assertConflict();

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/recipient/profile', [
                'full_name' => 'Updated Recipient',
                'phone' => '01700000010',
                'address' => 'New address',
                'household_size' => 5,
            ])->assertOk()
            ->assertJsonPath('data.full_name', 'Updated Recipient');

        $this->actingAs($otherUser, 'sanctum')
            ->getJson('/api/recipient/profile')
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->assertDatabaseCount('recipients', 1);
        $this->assertDatabaseHas('recipients', [
            'user_id' => $user->id,
            'full_name' => 'Updated Recipient',
        ]);
    }

    public function test_unverified_ngo_cannot_be_selected_for_recipient_profile(): void
    {
        $user = User::factory()->create(['role' => 'recipient']);
        $ngo = Ngo::create([
            'ngo_name' => 'Pending NGO',
            'registration_no' => 'NGO-PENDING-001',
            'email' => 'pending-ngo@example.com',
            'phone' => '01800000011',
            'is_verified' => false,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/recipient/profile', [
                'ngo_id' => $ngo->id,
                'full_name' => 'Recipient',
                'phone' => '01700000011',
                'address' => 'Dhaka',
                'household_size' => 2,
            ])->assertUnprocessable();

        $this->assertDatabaseCount('recipients', 0);
    }
}
