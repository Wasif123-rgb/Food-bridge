<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DonorController;
use App\Http\Controllers\Api\FoodDonationController;
use App\Http\Controllers\Api\NgoController;
use App\Http\Controllers\Api\VolunteerController;
use App\Http\Controllers\Api\FoodRequestController;
use App\Http\Controllers\Api\DeliveryController;
use App\Http\Controllers\Api\RecipientController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\DeliveryUpdateController;
use App\Http\Controllers\Api\FeedbackController;


// ==================== AUTH ROUTES ====================

Route::post(
    '/register',
    [AuthController::class, 'register']
);

Route::post(
    '/login',
    [AuthController::class, 'login']
);


// ==================== PROTECTED ROUTES ====================

Route::middleware('auth:sanctum')->group(function () {

    Route::get(
        '/user',
        [AuthController::class, 'user']
    );

    Route::post(
        '/logout',
        [AuthController::class, 'logout']
    );


    // ==================== ADMIN ====================

    Route::get(
        '/admin/dashboard',
        [AdminController::class, 'dashboard']
    );

    Route::put(
        '/admin/ngos/{id}/verify',
        [AdminController::class, 'verifyNgo']
    );

    Route::put(
        '/admin/ngos/{id}/unverify',
        [AdminController::class, 'unverifyNgo']
    );

    // Raw SQL transaction demonstration
    Route::post(
        '/admin/transactions/demo',
        [AdminController::class, 'transactionDemo']
    );


    // ==================== VOLUNTEER ====================

    Route::get(
        '/volunteer/profile',
        [VolunteerController::class, 'profile']
    );

    Route::put(
        '/volunteer/profile',
        [VolunteerController::class, 'updateProfile']
    );

    Route::get(
        '/volunteer/deliveries',
        [VolunteerController::class, 'assignedDeliveries']
    );


    // ==================== RESOURCES ====================

    Route::apiResource(
        'donors',
        DonorController::class
    );

    Route::apiResource(
        'food-donations',
        FoodDonationController::class
    );

    Route::apiResource(
        'ngos',
        NgoController::class
    );

    Route::apiResource(
        'volunteers',
        VolunteerController::class
    );

    Route::apiResource(
        'food-requests',
        FoodRequestController::class
    );

    Route::apiResource(
        'deliveries',
        DeliveryController::class
    );

    Route::apiResource(
        'recipients',
        RecipientController::class
    );

    Route::apiResource(
        'delivery-updates',
        DeliveryUpdateController::class
    );

    Route::apiResource(
        'feedback',
        FeedbackController::class
    );


    // ==================== NGO ====================

    Route::get(
        '/ngo/profile',
        [NgoController::class, 'profile']
    );

    Route::get(
        '/ngo/available-donations',
        [NgoController::class, 'availableDonations']
    );

    Route::get(
        '/ngo/requests',
        [NgoController::class, 'myRequests']
    );

    Route::post(
        '/ngo/requests',
        [NgoController::class, 'requestFood']
    );

});
