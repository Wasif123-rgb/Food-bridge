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
use App\Http\Controllers\Api\VolunteerDeliveryController;


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

    Route::get(
        '/admin/delivery-options',
        [AdminController::class, 'deliveryOptions']
    );

    Route::get(
        '/admin/food-requests/{requestId}/recipients',
        [AdminController::class, 'recipientsForRequest']
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
        [VolunteerDeliveryController::class, 'index']
    );

    Route::patch(
        '/volunteer/deliveries/{deliveryId}/status',
        [VolunteerDeliveryController::class, 'updateStatus']
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

    Route::get(
        '/ngo/recipients',
        [RecipientController::class, 'index']
    );

    Route::post(
        '/ngo/recipients',
        [RecipientController::class, 'store']
    );

    Route::get(
        '/ngo/recipients/{recipientNo}',
        [RecipientController::class, 'show']
    );

    Route::patch(
        '/ngo/recipients/{recipientNo}',
        [RecipientController::class, 'update']
    );

    Route::get(
        '/ngo/recipients/{recipientNo}/deliveries',
        [RecipientController::class, 'deliveries']
    );


    // ==================== RECIPIENT ====================

    Route::get(
        '/recipient/profile',
        [RecipientController::class, 'currentProfile']
    );

    Route::post(
        '/recipient/profile',
        [RecipientController::class, 'createCurrentProfile']
    );

    Route::patch(
        '/recipient/profile',
        [RecipientController::class, 'updateCurrentProfile']
    );

    Route::get(
        '/recipient/ngos',
        [RecipientController::class, 'verifiedNgos']
    );

    Route::get(
        '/recipient/deliveries',
        [RecipientController::class, 'currentDeliveries']
    );

});