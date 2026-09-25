<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['donor', 'ngo', 'volunteer', 'recipient', 'admin'] as $role) {
            Role::firstOrCreate(['name' => $role]);
        }
    }
}
