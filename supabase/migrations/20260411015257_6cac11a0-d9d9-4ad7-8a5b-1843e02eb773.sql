
-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Allow admins to view all trips
CREATE POLICY "Admins can view all trips"
ON public.trips
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Allow admins to view all aircrafts
CREATE POLICY "Admins can view all aircrafts"
ON public.aircrafts
FOR SELECT
TO authenticated
USING (public.is_admin());
