
-- 1) Update admin_delete_user_data to write audit entry first
CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_target uuid, _caller uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid;
  _actor_email text;
  _target_email text;
BEGIN
  IF NOT (
    public.is_admin()
    OR (
      _caller IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _caller AND role_name = 'Admin')
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  _actor := COALESCE(auth.uid(), _caller);
  SELECT email INTO _actor_email FROM public.profiles WHERE id = _actor;
  SELECT email INTO _target_email FROM public.profiles WHERE id = _target;

  INSERT INTO public.admin_audit_log (action, target_user_id, target_label, actor_id, actor_email, details)
  VALUES ('user.delete', _target, _target_email, _actor, _actor_email,
          jsonb_build_object('caller_param', _caller));

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

-- 2) Trigger: audit privileged profile changes (role, billing flags, enabled)
CREATE OR REPLACE FUNCTION public.audit_profile_privileged_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor uuid := auth.uid();
  _actor_email text;
  _changes jsonb := '{}'::jsonb;
BEGIN
  IF _actor IS NULL THEN
    RETURN NEW; -- system / definer calls without auth context
  END IF;

  IF NEW.role_name IS DISTINCT FROM OLD.role_name THEN
    _changes := _changes || jsonb_build_object('role_name', jsonb_build_object('from', OLD.role_name, 'to', NEW.role_name));
  END IF;
  IF NEW.is_billing_manager IS DISTINCT FROM OLD.is_billing_manager THEN
    _changes := _changes || jsonb_build_object('is_billing_manager', jsonb_build_object('from', OLD.is_billing_manager, 'to', NEW.is_billing_manager));
  END IF;
  IF NEW.billing_exempt IS DISTINCT FROM OLD.billing_exempt THEN
    _changes := _changes || jsonb_build_object('billing_exempt', jsonb_build_object('from', OLD.billing_exempt, 'to', NEW.billing_exempt));
  END IF;
  IF NEW.is_enabled IS DISTINCT FROM OLD.is_enabled THEN
    _changes := _changes || jsonb_build_object('is_enabled', jsonb_build_object('from', OLD.is_enabled, 'to', NEW.is_enabled));
  END IF;

  IF _changes <> '{}'::jsonb THEN
    SELECT email INTO _actor_email FROM public.profiles WHERE id = _actor;
    INSERT INTO public.admin_audit_log (action, target_user_id, target_label, actor_id, actor_email, details)
    VALUES ('profile.privileged_update', NEW.id, NEW.email, _actor, _actor_email, _changes);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profile_privileged ON public.profiles;
CREATE TRIGGER trg_audit_profile_privileged
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_profile_privileged_changes();

-- 3) Trigger: audit aircraft deletions
CREATE OR REPLACE FUNCTION public.audit_aircraft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor uuid := auth.uid();
  _actor_email text;
BEGIN
  IF _actor IS NULL THEN
    RETURN OLD;
  END IF;
  SELECT email INTO _actor_email FROM public.profiles WHERE id = _actor;
  INSERT INTO public.admin_audit_log (action, target_user_id, target_label, actor_id, actor_email, details)
  VALUES ('aircraft.delete', OLD.user_company, OLD.tail_number, _actor, _actor_email,
          jsonb_build_object('aircraft_id', OLD.id, 'tail_number', OLD.tail_number, 'manufacturer', OLD.manufacturer, 'type', OLD.type));
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_aircraft_delete ON public.aircrafts;
CREATE TRIGGER trg_audit_aircraft_delete
AFTER DELETE ON public.aircrafts
FOR EACH ROW EXECUTE FUNCTION public.audit_aircraft_delete();

-- 4) Trigger: audit subscription billing changes by admins
CREATE OR REPLACE FUNCTION public.audit_subscription_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor uuid := auth.uid();
  _actor_email text;
  _changes jsonb := '{}'::jsonb;
BEGIN
  IF _actor IS NULL OR _actor = NEW.user_id THEN
    RETURN NEW; -- only audit admin/operator changes, not self/system
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _changes := _changes || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle THEN
    _changes := _changes || jsonb_build_object('billing_cycle', jsonb_build_object('from', OLD.billing_cycle, 'to', NEW.billing_cycle));
  END IF;
  IF NEW.monthly_amount_cents IS DISTINCT FROM OLD.monthly_amount_cents THEN
    _changes := _changes || jsonb_build_object('monthly_amount_cents', jsonb_build_object('from', OLD.monthly_amount_cents, 'to', NEW.monthly_amount_cents));
  END IF;
  IF NEW.canceled_at IS DISTINCT FROM OLD.canceled_at THEN
    _changes := _changes || jsonb_build_object('canceled_at', jsonb_build_object('from', OLD.canceled_at, 'to', NEW.canceled_at));
  END IF;

  IF _changes <> '{}'::jsonb THEN
    SELECT email INTO _actor_email FROM public.profiles WHERE id = _actor;
    INSERT INTO public.admin_audit_log (action, target_user_id, target_label, actor_id, actor_email, details)
    VALUES ('subscription.update', NEW.user_id, NEW.stripe_subscription_id, _actor, _actor_email, _changes);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_subscription_changes ON public.subscriptions;
CREATE TRIGGER trg_audit_subscription_changes
AFTER UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.audit_subscription_changes();
