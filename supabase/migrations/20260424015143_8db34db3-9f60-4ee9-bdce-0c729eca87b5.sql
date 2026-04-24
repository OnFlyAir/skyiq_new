
-- 1. Add is_billing_manager flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_billing_manager boolean NOT NULL DEFAULT false;

-- 2. Make sure billing_cycle enum has 'annual' (existing default is 'four_weekly')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'billing_cycle' AND e.enumlabel = 'annual'
  ) THEN
    ALTER TYPE billing_cycle ADD VALUE 'annual';
  END IF;
END$$;

-- 3. Add columns to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_billing_cycle billing_cycle,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- 4. Helper function: is the current user a billing manager (Admin / Dev / flagged)?
CREATE OR REPLACE FUNCTION public.can_manage_billing(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND (role_name IN ('Admin', 'Dev') OR is_billing_manager = true)
  );
$$;

-- 5. Helper function: is this user billing-exempt (Admin or Dev)?
CREATE OR REPLACE FUNCTION public.is_billing_exempt(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND role_name IN ('Admin', 'Dev')
  );
$$;
