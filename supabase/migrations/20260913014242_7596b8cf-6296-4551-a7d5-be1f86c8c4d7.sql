CREATE TABLE public.cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id uuid,
  reason text NOT NULL DEFAULT '',
  code_hash text,
  code_expires_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  offer_shown boolean NOT NULL DEFAULT false,
  offer_accepted boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

GRANT SELECT ON public.cancellation_requests TO authenticated;
GRANT ALL ON public.cancellation_requests TO service_role;

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cancellation requests"
  ON public.cancellation_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE TRIGGER trg_cancellation_requests_updated
  BEFORE UPDATE ON public.cancellation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS retention_discount_percent integer,
  ADD COLUMN IF NOT EXISTS retention_discount_applied_at timestamptz;