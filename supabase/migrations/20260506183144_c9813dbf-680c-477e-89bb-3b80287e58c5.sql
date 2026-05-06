
-- 1) onfly_data: allow users to read their own rows
CREATE POLICY "Users can view own onfly_data"
ON public.onfly_data
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2) itinerary-pdfs storage: add path-scoped UPDATE and DELETE for owners
CREATE POLICY "Users can update own itinerary PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'itinerary-pdfs' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'itinerary-pdfs' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own itinerary PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'itinerary-pdfs' AND (auth.uid())::text = (storage.foldername(name))[1]);
