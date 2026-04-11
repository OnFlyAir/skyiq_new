CREATE OR REPLACE FUNCTION public.calculate_subscription_price(plane_count INTEGER)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE total INTEGER := 0;
BEGIN
  IF plane_count <= 0 THEN RETURN 0; END IF;
  IF plane_count >= 4 THEN total := 4 * 20000;
  ELSE RETURN plane_count * 20000; END IF;
  IF plane_count >= 9 THEN total := total + 5 * 15000;
  ELSIF plane_count > 4 THEN RETURN total + (plane_count - 4) * 15000; END IF;
  IF plane_count > 9 THEN total := total + (plane_count - 9) * 10000; END IF;
  RETURN total;
END; $$;