
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'pilot',
  operator_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create operators table
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from profiles to operators
ALTER TABLE public.profiles ADD CONSTRAINT profiles_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.operators(id);

-- Create operator_invites table
CREATE TABLE public.operator_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'pilot',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create aircraft table
CREATE TABLE public.aircraft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  tail_number TEXT NOT NULL,
  nickname TEXT,
  manufacturer TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  aircraft_type TEXT NOT NULL DEFAULT 'midsize_jet',
  basic_empty_weight NUMERIC NOT NULL DEFAULT 0,
  max_takeoff_weight NUMERIC NOT NULL DEFAULT 0,
  max_landing_weight NUMERIC NOT NULL DEFAULT 0,
  max_ramp_weight NUMERIC NOT NULL DEFAULT 0,
  preferred_reserve NUMERIC NOT NULL DEFAULT 0,
  max_fuel_capacity NUMERIC NOT NULL DEFAULT 0,
  taxi_fuel_burn NUMERIC NOT NULL DEFAULT 0,
  default_pax_weight NUMERIC NOT NULL DEFAULT 200,
  baggage_weight_with_pax NUMERIC NOT NULL DEFAULT 0,
  baggage_weight_without_pax NUMERIC NOT NULL DEFAULT 0,
  default_pic_weight NUMERIC NOT NULL DEFAULT 200,
  default_sic_weight NUMERIC NOT NULL DEFAULT 200,
  cabin_attendant_weight NUMERIC NOT NULL DEFAULT 0,
  cruise_fuel_burn NUMERIC NOT NULL DEFAULT 0,
  penalty_rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create trips table
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  trip_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  current_fuel_on_board NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC,
  total_savings NUMERIC,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create trip_legs table
CREATE TABLE public.trip_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  leg_number INTEGER NOT NULL DEFAULT 1,
  departure_icao TEXT NOT NULL DEFAULT '',
  destination_icao TEXT NOT NULL DEFAULT '',
  departure_fee_cost NUMERIC NOT NULL DEFAULT 0,
  departure_fee_waived_with NUMERIC NOT NULL DEFAULT 0,
  crew_weights JSONB NOT NULL DEFAULT '[]',
  passenger_weights JSONB NOT NULL DEFAULT '[]',
  baggage_weight NUMERIC NOT NULL DEFAULT 0,
  fuel_price_tiers JSONB NOT NULL DEFAULT '[]',
  reserve NUMERIC NOT NULL DEFAULT 0,
  taxi_fuel_burn NUMERIC NOT NULL DEFAULT 0,
  max_takeoff_weight NUMERIC NOT NULL DEFAULT 0,
  max_landing_weight NUMERIC NOT NULL DEFAULT 0,
  fuel_burn NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create trip_leg_results table
CREATE TABLE public.trip_leg_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_leg_id UUID NOT NULL REFERENCES public.trip_legs(id) ON DELETE CASCADE,
  fuel_to_uplift_gallons NUMERIC NOT NULL DEFAULT 0,
  fuel_to_uplift_lbs NUMERIC NOT NULL DEFAULT 0,
  starting_fuel_lbs NUMERIC NOT NULL DEFAULT 0,
  landing_fuel_lbs NUMERIC NOT NULL DEFAULT 0,
  takeoff_weight_lbs NUMERIC NOT NULL DEFAULT 0,
  landing_weight_lbs NUMERIC NOT NULL DEFAULT 0,
  fuel_cost NUMERIC NOT NULL DEFAULT 0,
  waived_fees TEXT NOT NULL DEFAULT '',
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_leg_results ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Operators: members can view their operator
CREATE POLICY "Members can view their operator" ON public.operators FOR SELECT TO authenticated USING (
  id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Authenticated users can create operators" ON public.operators FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- Operator invites: operator admins can manage invites
CREATE POLICY "Admins can view invites" ON public.operator_invites FOR SELECT TO authenticated USING (
  operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Admins can create invites" ON public.operator_invites FOR INSERT TO authenticated WITH CHECK (
  operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid() AND role = 'operator_admin')
);
CREATE POLICY "Users can view own invites" ON public.operator_invites FOR SELECT TO authenticated USING (email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid()));
CREATE POLICY "Users can update own invites" ON public.operator_invites FOR UPDATE TO authenticated USING (email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid()));

-- Aircraft: operator members can CRUD
CREATE POLICY "Members can view aircraft" ON public.aircraft FOR SELECT TO authenticated USING (
  operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Members can insert aircraft" ON public.aircraft FOR INSERT TO authenticated WITH CHECK (
  operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Members can update aircraft" ON public.aircraft FOR UPDATE TO authenticated USING (
  operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Members can delete aircraft" ON public.aircraft FOR DELETE TO authenticated USING (
  operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- Trips: operator members can CRUD
CREATE POLICY "Members can view trips" ON public.trips FOR SELECT TO authenticated USING (
  operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Members can insert trips" ON public.trips FOR INSERT TO authenticated WITH CHECK (
  operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Members can update trips" ON public.trips FOR UPDATE TO authenticated USING (
  operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Members can delete trips" ON public.trips FOR DELETE TO authenticated USING (
  operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- Trip legs: access via trip's operator
CREATE POLICY "Members can view trip legs" ON public.trip_legs FOR SELECT TO authenticated USING (
  trip_id IN (SELECT id FROM public.trips WHERE operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid()))
);
CREATE POLICY "Members can insert trip legs" ON public.trip_legs FOR INSERT TO authenticated WITH CHECK (
  trip_id IN (SELECT id FROM public.trips WHERE operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid()))
);
CREATE POLICY "Members can update trip legs" ON public.trip_legs FOR UPDATE TO authenticated USING (
  trip_id IN (SELECT id FROM public.trips WHERE operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid()))
);
CREATE POLICY "Members can delete trip legs" ON public.trip_legs FOR DELETE TO authenticated USING (
  trip_id IN (SELECT id FROM public.trips WHERE operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid()))
);

-- Trip leg results: access via trip leg's trip's operator
CREATE POLICY "Members can view trip leg results" ON public.trip_leg_results FOR SELECT TO authenticated USING (
  trip_leg_id IN (SELECT id FROM public.trip_legs WHERE trip_id IN (SELECT id FROM public.trips WHERE operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())))
);
CREATE POLICY "Members can insert trip leg results" ON public.trip_leg_results FOR INSERT TO authenticated WITH CHECK (
  trip_leg_id IN (SELECT id FROM public.trip_legs WHERE trip_id IN (SELECT id FROM public.trips WHERE operator_id IN (SELECT operator_id FROM public.profiles WHERE profiles.id = auth.uid())))
);

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
