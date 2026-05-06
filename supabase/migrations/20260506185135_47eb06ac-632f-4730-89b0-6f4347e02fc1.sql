
-- Tighten analytics_events INSERT: require user_id = auth.uid()
DROP POLICY IF EXISTS "Users can insert their own events" ON public.analytics_events;
CREATE POLICY "Users can insert their own events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Add explicit owner-scoped UPDATE/DELETE policies on itinerary-pdfs bucket
DROP POLICY IF EXISTS "Users can update own itinerary pdfs" ON storage.objects;
CREATE POLICY "Users can update own itinerary pdfs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'itinerary-pdfs' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'itinerary-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own itinerary pdfs" ON storage.objects;
CREATE POLICY "Users can delete own itinerary pdfs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'itinerary-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
