-- 1) Lock down profile self-updates: block role escalation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile (safe fields)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role_name IS NOT DISTINCT FROM (SELECT p.role_name FROM public.profiles p WHERE p.id = auth.uid())
  AND is_billing_manager IS NOT DISTINCT FROM (SELECT p.is_billing_manager FROM public.profiles p WHERE p.id = auth.uid())
  AND is_enabled IS NOT DISTINCT FROM (SELECT p.is_enabled FROM public.profiles p WHERE p.id = auth.uid())
);

-- Admins can update anyone (already exists but ensure it covers role changes)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 2) Pull billing_email_log off realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.billing_email_log;

-- 3) Drop the over-permissive itinerary-pdfs INSERT policy
DROP POLICY IF EXISTS "Authenticated users can upload itinerary PDFs" ON storage.objects;