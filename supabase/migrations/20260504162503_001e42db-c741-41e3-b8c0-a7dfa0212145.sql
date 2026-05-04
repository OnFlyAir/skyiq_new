CREATE POLICY "Users can delete own demo trips"
ON public.trips
FOR DELETE
TO public
USING (auth.uid() = user_company AND is_demo = true);