-- SkyIQ 2.0 Database Schema
-- Run this in Supabase SQL Editor or via migrations

-- ============================================
-- ENUMS
-- ============================================

create type user_role as enum ('super_admin', 'operator_admin', 'pilot');
create type aircraft_type as enum (
  'very_light_jet',
  'light_jet',
  'midsize_jet',
  'super_mid_jet',
  'large_jet',
  'heavy_jet',
  'ultra_long_range_jet',
  'turboprop'
);
create type trip_status as enum ('draft', 'confirmed', 'completed');
create type invite_status as enum ('pending', 'accepted', 'declined');
create type member_role as enum ('operator_admin', 'pilot');

-- ============================================
-- OPERATORS
-- ============================================

create table operators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  role user_role not null default 'pilot',
  operator_id uuid references operators(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- OPERATOR INVITES
-- ============================================

create table operator_invites (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  email text not null,
  role member_role not null default 'pilot',
  status invite_status not null default 'pending',
  invited_by uuid not null references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================
-- AIRCRAFT
-- ============================================

create table aircraft (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  tail_number text not null,
  nickname text,
  manufacturer text not null default '',
  model text not null default '',
  aircraft_type aircraft_type not null,
  basic_empty_weight numeric not null default 0,
  max_takeoff_weight numeric not null default 0,
  max_landing_weight numeric not null default 0,
  max_ramp_weight numeric not null default 0,
  preferred_reserve numeric not null default 0,
  max_fuel_capacity numeric not null default 0,
  taxi_fuel_burn numeric not null default 0,
  default_pax_weight numeric not null default 170,
  baggage_weight_with_pax numeric not null default 0,
  baggage_weight_without_pax numeric not null default 0,
  default_pic_weight numeric not null default 200,
  default_sic_weight numeric not null default 200,
  cabin_attendant_weight numeric not null default 0,
  cruise_fuel_burn numeric not null default 0,
  penalty_rate numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- TRIPS
-- ============================================

create table trips (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  aircraft_id uuid not null references aircraft(id) on delete cascade,
  trip_number text not null,
  status trip_status not null default 'draft',
  current_fuel_on_board numeric not null default 0,
  total_cost numeric,
  total_savings numeric,
  created_by uuid not null references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- TRIP LEGS
-- ============================================

create table trip_legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  leg_number integer not null,
  departure_icao text not null,
  destination_icao text not null,
  departure_fee_cost numeric not null default 0,
  departure_fee_waived_with numeric not null default 0,
  crew_weights numeric[] not null default '{}',
  passenger_weights numeric[] not null default '{}',
  baggage_weight numeric not null default 0,
  fuel_price_tiers jsonb not null default '[]',
  reserve numeric not null default 0,
  taxi_fuel_burn numeric not null default 0,
  max_takeoff_weight numeric not null default 0,
  max_landing_weight numeric not null default 0,
  fuel_burn numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- TRIP LEG RESULTS (algorithm output)
-- ============================================

create table trip_leg_results (
  id uuid primary key default gen_random_uuid(),
  trip_leg_id uuid not null references trip_legs(id) on delete cascade,
  fuel_to_uplift_gallons numeric not null default 0,
  fuel_to_uplift_lbs numeric not null default 0,
  starting_fuel_lbs numeric not null default 0,
  landing_fuel_lbs numeric not null default 0,
  takeoff_weight_lbs numeric not null default 0,
  landing_weight_lbs numeric not null default 0,
  fuel_cost numeric not null default 0,
  waived_fees text not null default 'No fees',
  total_cost numeric not null default 0,
  created_at timestamptz default now()
);

-- ============================================
-- TRIP PDF UPLOADS
-- ============================================

create table trip_uploads (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  file_name text not null,
  file_path text not null,
  parsed_data jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================

create index idx_profiles_operator on profiles(operator_id);
create index idx_profiles_role on profiles(role);
create index idx_aircraft_operator on aircraft(operator_id);
create index idx_trips_operator on trips(operator_id);
create index idx_trips_aircraft on trips(aircraft_id);
create index idx_trips_created_by on trips(created_by);
create index idx_trip_legs_trip on trip_legs(trip_id);
create index idx_trip_leg_results_leg on trip_leg_results(trip_leg_id);
create index idx_operator_invites_email on operator_invites(email);
create index idx_operator_invites_operator on operator_invites(operator_id);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    'pilot'
  );

  -- Check for pending invites and auto-link to operator
  update profiles
  set operator_id = inv.operator_id,
      role = inv.role::text::user_role
  from operator_invites inv
  where profiles.id = new.id
    and inv.email = new.email
    and inv.status = 'pending';

  -- Mark invite as accepted
  update operator_invites
  set status = 'accepted'
  where email = new.email
    and status = 'pending';

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();
create trigger set_updated_at before update on operators
  for each row execute function update_updated_at();
create trigger set_updated_at before update on aircraft
  for each row execute function update_updated_at();
create trigger set_updated_at before update on trips
  for each row execute function update_updated_at();
create trigger set_updated_at before update on trip_legs
  for each row execute function update_updated_at();
