
-- DFY Clients table
CREATE TABLE public.dfy_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_name text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  pricing_tier text NOT NULL DEFAULT 'per_trip',
  per_trip_rate_cents integer NOT NULL DEFAULT 20000,
  monthly_rate_cents integer NOT NULL DEFAULT 1000000,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dfy_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on dfy_clients" ON public.dfy_clients FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users can view own dfy_client record" ON public.dfy_clients FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- DFY Requests table
CREATE TABLE public.dfy_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.dfy_clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  pdf_storage_path text,
  admin_notes text NOT NULL DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dfy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on dfy_requests" ON public.dfy_requests FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users can view own dfy_requests" ON public.dfy_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.dfy_clients WHERE id = dfy_requests.client_id AND user_id = auth.uid())
);

CREATE POLICY "Users can insert own dfy_requests" ON public.dfy_requests FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.dfy_clients WHERE id = dfy_requests.client_id AND user_id = auth.uid())
);

-- Timestamps triggers
CREATE TRIGGER update_dfy_clients_updated_at BEFORE UPDATE ON public.dfy_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dfy_requests_updated_at BEFORE UPDATE ON public.dfy_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for itinerary PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('itinerary-pdfs', 'itinerary-pdfs', false);

CREATE POLICY "Admins can manage all itinerary PDFs" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'itinerary-pdfs' AND public.is_admin()) WITH CHECK (bucket_id = 'itinerary-pdfs' AND public.is_admin());

CREATE POLICY "Users can upload own itinerary PDFs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'itinerary-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own itinerary PDFs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'itinerary-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to insert into onfly_data (for edge function)
CREATE POLICY "Authenticated users can insert own onfly_data" ON public.onfly_data FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
