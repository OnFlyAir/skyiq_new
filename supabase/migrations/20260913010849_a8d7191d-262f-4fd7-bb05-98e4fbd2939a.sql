CREATE OR REPLACE FUNCTION public.calculate_subscription_price(plane_count integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE total INTEGER := 0;
BEGIN
  IF plane_count <= 0 THEN RETURN 0; END IF;
  total := LEAST(plane_count, 3) * 20000;
  IF plane_count > 3 THEN total := total + LEAST(plane_count - 3, 3) * 15000; END IF;
  IF plane_count > 6 THEN total := total + (plane_count - 6) * 10000; END IF;
  RETURN total;
END; $function$;

ALTER TABLE public.subscriptions
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + INTERVAL '30 days');