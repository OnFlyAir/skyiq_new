
CREATE TABLE public.onfly_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id INTEGER REFERENCES public.trips(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  client_name TEXT DEFAULT '',
  client_email TEXT DEFAULT '',
  client_phone TEXT DEFAULT '',
  itinerary_num TEXT DEFAULT '',
  raw_itinerary JSONB DEFAULT '{}'::jsonb,
  parsed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.onfly_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all onfly_data"
  ON public.onfly_data FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert onfly_data"
  ON public.onfly_data FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update onfly_data"
  ON public.onfly_data FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete onfly_data"
  ON public.onfly_data FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE INDEX idx_onfly_data_user_id ON public.onfly_data(user_id);
CREATE INDEX idx_onfly_data_trip_id ON public.onfly_data(trip_id);
