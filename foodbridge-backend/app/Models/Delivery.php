<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Delivery extends Model
{
    protected $fillable = [
        'request_id',
        'volunteer_id',
        'recipient_id',
        'pickup_time',
        'delivered_at',
        'delivery_status',
    ];

    protected $casts = [
        'pickup_time' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    public function foodRequest(): BelongsTo
    {
        return $this->belongsTo(FoodRequest::class, 'request_id');
    }

    public function volunteer(): BelongsTo
    {
        return $this->belongsTo(Volunteer::class);
    }

    public function updates(): HasMany
    {
        return $this->hasMany(DeliveryUpdate::class);
    }

    public function feedback(): HasOne
    {
        return $this->hasOne(Feedback::class);
    }
}
