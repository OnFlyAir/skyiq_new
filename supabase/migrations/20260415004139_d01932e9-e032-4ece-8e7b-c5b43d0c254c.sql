
-- Add pdf_storage_path column
ALTER TABLE public.onfly_data ADD COLUMN IF NOT EXISTS pdf_storage_path text;

-- Remove duplicates: keep only the latest row per trip_id
DELETE FROM public.onfly_data a
USING public.onfly_data b
WHERE a.trip_id IS NOT NULL
  AND a.trip_id = b.trip_id
  AND a.parsed_at < b.parsed_at;

-- Add unique constraint on trip_id (partial, only where not null)
CREATE UNIQUE INDEX IF NOT EXISTS onfly_data_trip_id_unique ON public.onfly_data (trip_id) WHERE trip_id IS NOT NULL;

-- Allow admins to read from itinerary-pdfs bucket
CREATE POLICY "Admins can read itinerary PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'itinerary-pdfs' AND public.is_admin());

-- Allow authenticated users to upload to itinerary-pdfs
CREATE POLICY "Authenticated users can upload itinerary PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'itinerary-pdfs');
