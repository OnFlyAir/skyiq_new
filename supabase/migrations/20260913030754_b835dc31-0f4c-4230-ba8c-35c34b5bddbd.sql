CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    _first text;
    _last text;
    _full text;
BEGIN
    _first := NULLIF(NEW.raw_user_meta_data->>'first_name', '');
    _last := NULLIF(NEW.raw_user_meta_data->>'last_name', '');
    -- Google and other OAuth providers supply a single display name instead.
    IF _first IS NULL AND _last IS NULL THEN
        _full := NULLIF(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), '');
        IF _full IS NOT NULL THEN
            _first := split_part(_full, ' ', 1);
            _last := NULLIF(btrim(substr(_full, length(_first) + 1)), '');
        END IF;
    END IF;
    INSERT INTO public.profiles (id, email, first_name, last_name, created_on)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(_first, ''),
        COALESCE(_last, ''),
        NOW()
    );
    RETURN NEW;
END;
$function$;