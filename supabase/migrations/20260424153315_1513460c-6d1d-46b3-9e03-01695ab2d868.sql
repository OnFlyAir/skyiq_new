CREATE TABLE public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE,
  event_type text NOT NULL,
  environment text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  error_message text,
  user_id uuid,
  stripe_customer_id text,
  stripe_subscription_id text,
  amount_cents integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_stripe_webhook_events_received_at ON public.stripe_webhook_events(received_at DESC);
CREATE INDEX idx_stripe_webhook_events_user_id ON public.stripe_webhook_events(user_id);
CREATE INDEX idx_stripe_webhook_events_type ON public.stripe_webhook_events(event_type);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
  ON public.stripe_webhook_events FOR SELECT
  TO authenticated
  USING (is_admin());