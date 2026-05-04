CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_target uuid, _caller uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow either: an authenticated admin caller (auth.uid()), or an explicit
  -- _caller uuid that is an Admin (used when invoked from a service-role edge function).
  IF NOT (
    public.is_admin()
    OR (
      _caller IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _caller AND role_name = 'Admin')
    )
  ) THEN
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
$function$;