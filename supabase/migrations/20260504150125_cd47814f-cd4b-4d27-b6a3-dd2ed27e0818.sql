
-- 1. Per-user billing exempt flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_exempt boolean NOT NULL DEFAULT false;

-- 2. Update billing-exempt check to include the new column
CREATE OR REPLACE FUNCTION public.is_billing_exempt(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND (role_name IN ('Admin', 'Dev') OR billing_exempt = true)
  );
$$;

-- 3. Admin policies on aircrafts so admins can manage any user's fleet
DROP POLICY IF EXISTS "Admins can insert any aircraft" ON public.aircrafts;
CREATE POLICY "Admins can insert any aircraft"
  ON public.aircrafts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any aircraft" ON public.aircrafts;
CREATE POLICY "Admins can update any aircraft"
  ON public.aircrafts FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any aircraft" ON public.aircrafts;
CREATE POLICY "Admins can delete any aircraft"
  ON public.aircrafts FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 4. Server function for admin to wipe a user's app data
--    (auth.users removal requires service-role; done by edge function)
CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.subscriptions WHERE user_id = _target;
  DELETE FROM public.aircrafts WHERE user_company = _target;
  DELETE FROM public.trips WHERE user_company = _target;
  DELETE FROM public.email_lists WHERE user_id = _target;
  DELETE FROM public.dfy_usage_charges WHERE user_id = _target;
  DELETE FROM public.dfy_clients WHERE user_id = _target;
  DELETE FROM public.onfly_data WHERE user_id = _target;
  DELETE FROM public.analytics_events WHERE user_id = _target;
  DELETE FROM public.billing_email_log WHERE user_id = _target;
  DELETE FROM public.profiles WHERE id = _target;
END;
$$;
