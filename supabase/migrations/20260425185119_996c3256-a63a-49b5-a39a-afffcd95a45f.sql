-- Allow any authenticated user to auto-provision their own dfy_clients row
CREATE POLICY "Users can insert own dfy_client record"
ON public.dfy_clients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own dfy_client record (e.g. company name)
CREATE POLICY "Users can update own dfy_client record"
ON public.dfy_clients
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);