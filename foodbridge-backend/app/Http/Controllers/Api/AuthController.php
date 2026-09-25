<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Donor;
use App\Models\Volunteer;
use App\Models\Ngo;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class AuthController extends Controller
{
    // SIGNUP
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'phone' => 'required|string|max:255',
            'role' => 'required|string|in:donor,ngo,volunteer,recipient',
            'password' => 'required|string|min:6|confirmed',
        ]);

        $result = DB::transaction(function () use ($validated) {

            $role = Role::firstOrCreate([
                'name' => $validated['role'],
            ]);

            // Create user
            $user = User::create([
                'role_id' => $role->id,
                'name' => $validated['name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'],
                'role' => $validated['role'],
                'password' => $validated['password'],
            ]);

            // If user registered as donor,
            // automatically create their donor profile.
            if ($validated['role'] === 'donor') {
                Donor::create([
                    'user_id' => $user->id,
                    'donor_name' => $user->name,
                    'donor_type' => 'Individual',
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'address' => null,
                ]);
            }

            if ($validated['role'] === 'volunteer') {
                Volunteer::create([
                    'user_id' => $user->id,
                    'full_name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'availability_status' => 'Offline',
                    'vehicle_type' => 'None',
                ]);
            }
            if ($validated['role'] === 'ngo') {
    Ngo::create([
        'ngo_name' => $user->name,
        'registration_no' => 'NGO-' . str_pad($user->id, 6, '0', STR_PAD_LEFT),
        'email' => $user->email,
        'phone' => $user->phone,
        'address' => null,
        'is_verified' => false,
    ]);
}

            $token = $user->createToken('auth_token')->plainTextToken;

            return [
                'user' => $user,
                'token' => $token,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Account created successfully',
            'user' => $result['user'],
            'token' => $result['token'],
        ], 201);
    }


    // LOGIN
    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid email or password',
            ], 401);
        }

        // Delete previous tokens
        $user->tokens()->delete();

        // Create new token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'user' => $user,
            'token' => $token,
        ]);
    }


    // LOGOUT
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logout successful',
        ]);
    }


    // CURRENT USER
    public function user(Request $request)
    {
        return response()->json([
            'success' => true,
            'user' => $request->user(),
        ]);
    }
}
