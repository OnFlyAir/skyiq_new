
-- Step 1: Drop old tables (order matters for foreign keys)
DROP TABLE IF EXISTS trip_leg_results CASCADE;
DROP TABLE IF EXISTS trip_legs CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS aircraft CASCADE;
DROP TABLE IF EXISTS operator_invites CASCADE;
DROP TABLE IF EXISTS operators CASCADE;

-- Step 2: Drop old profiles policies and columns, recreate with new schema
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

ALTER TABLE profiles DROP COLUMN IF EXISTS operator_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS role;
ALTER TABLE profiles DROP COLUMN IF EXISTS updated_at;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_name TEXT DEFAULT 'User';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE;
-- Rename created_at to created_on if it exists as created_at
ALTER TABLE profiles RENAME COLUMN created_at TO created_on;

-- Recreate profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Step 3: Update handle_new_user function for new profile columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, created_on)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Create carry_types table
CREATE TABLE IF NOT EXISTS carry_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    penalty_rate DOUBLE PRECISION DEFAULT 0,
    cruise_fuel_burn DOUBLE PRECISION DEFAULT 0
);

ALTER TABLE carry_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view carry types" ON carry_types FOR SELECT USING (auth.role() = 'authenticated');

-- Step 5: Create aircrafts table
CREATE TABLE IF NOT EXISTS aircrafts (
    id SERIAL PRIMARY KEY,
    tail_number TEXT NOT NULL DEFAULT '',
    basic_empty_weight DOUBLE PRECISION DEFAULT 0,
    max_takeoff_weight DOUBLE PRECISION DEFAULT 0,
    max_landing_weight DOUBLE PRECISION DEFAULT 0,
    preferred_reserve DOUBLE PRECISION DEFAULT 0,
    max_fuel_capacity DOUBLE PRECISION DEFAULT 0,
    manufacturer TEXT DEFAULT '',
    type TEXT DEFAULT '',
    user_company UUID REFERENCES profiles(id) ON DELETE SET NULL,
    taxi_fuel_burn DOUBLE PRECISION DEFAULT 0,
    max_ramp_weight DOUBLE PRECISION DEFAULT 0,
    default_pax_weight DOUBLE PRECISION DEFAULT 0,
    default_baggage_with_pax DOUBLE PRECISION DEFAULT 0,
    default_baggage_no_pax DOUBLE PRECISION DEFAULT 0,
    default_pic_weight DOUBLE PRECISION DEFAULT 0,
    default_sic_weight DOUBLE PRECISION DEFAULT 0,
    default_cabin_weight DOUBLE PRECISION DEFAULT 0,
    is_enabled BOOLEAN DEFAULT TRUE,
    carry_type_id INTEGER REFERENCES carry_types(id) ON DELETE SET NULL,
    penalty_rate DOUBLE PRECISION DEFAULT 0,
    cruise_fuel_burn DOUBLE PRECISION DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_aircrafts_company ON aircrafts(user_company);
CREATE INDEX IF NOT EXISTS idx_aircrafts_tail ON aircrafts(tail_number);

ALTER TABLE aircrafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own aircrafts" ON aircrafts FOR SELECT USING (auth.uid() = user_company);
CREATE POLICY "Users can insert own aircrafts" ON aircrafts FOR INSERT WITH CHECK (auth.uid() = user_company);
CREATE POLICY "Users can update own aircrafts" ON aircrafts FOR UPDATE USING (auth.uid() = user_company);
CREATE POLICY "Users can delete own aircrafts" ON aircrafts FOR DELETE USING (auth.uid() = user_company);

-- Step 6: Create trips table (JSON-based)
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    details JSONB DEFAULT '{}',
    itinerary_details JSONB DEFAULT '{}',
    itinerary_num TEXT DEFAULT '',
    savings DOUBLE PRECISION DEFAULT 0,
    user_company UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_on TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_company ON trips(user_company);
CREATE INDEX IF NOT EXISTS idx_trips_created ON trips(created_on DESC);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own trips" ON trips FOR SELECT USING (auth.uid() = user_company);
CREATE POLICY "Users can insert own trips" ON trips FOR INSERT WITH CHECK (auth.uid() = user_company);
CREATE POLICY "Users can update own trips" ON trips FOR UPDATE USING (auth.uid() = user_company);

-- Step 7: Create email_lists table
CREATE TABLE IF NOT EXISTS email_lists (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    emails JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_email_lists_user ON email_lists(user_id);

ALTER TABLE email_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own email list" ON email_lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email list" ON email_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email list" ON email_lists FOR UPDATE USING (auth.uid() = user_id);

-- Step 8: Admin helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role_name = 'Admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
