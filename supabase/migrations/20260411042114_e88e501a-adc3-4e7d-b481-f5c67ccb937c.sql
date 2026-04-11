
-- Create the updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Timestamp triggers for DFY tables (tables already created by previous partial migration)
-- Check if tables exist first; if not, the enums and tables were already created
DO $$
BEGIN
  -- Only create triggers if tables exist (they were created in the failed migration)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dfy_clients' AND table_schema = 'public') THEN
    CREATE TRIGGER update_dfy_clients_updated_at
      BEFORE UPDATE ON public.dfy_clients
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dfy_requests' AND table_schema = 'public') THEN
    CREATE TRIGGER update_dfy_requests_updated_at
      BEFORE UPDATE ON public.dfy_requests
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
