
-- Add columns for fuel burns and parsed results
ALTER TABLE public.dfy_requests ADD COLUMN IF NOT EXISTS fuel_burns jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.dfy_requests ADD COLUMN IF NOT EXISTS parsed_result jsonb DEFAULT '{}'::jsonb;

-- Update default per-trip rate to $25 (2500 cents)
ALTER TABLE public.dfy_clients ALTER COLUMN per_trip_rate_cents SET DEFAULT 2500;

-- Create dfy-uploads storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('dfy-uploads', 'dfy-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for dfy-uploads
CREATE POLICY "Users can upload to dfy-uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dfy-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own dfy uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'dfy-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all dfy uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'dfy-uploads' AND public.is_admin());
