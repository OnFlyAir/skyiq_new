-- DFY metered usage charges that roll up onto the user's next subscription invoice
CREATE TABLE public.dfy_usage_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_id uuid NOT NULL UNIQUE,
  client_id uuid NOT NULL,
  amount_cents integer NOT NULL DEFAULT 2500,
  description text NOT NULL DEFAULT 'Fuel Planning (DFY)',
  status text NOT NULL DEFAULT 'pending_invoice', -- pending_invoice | invoiced | refunded | voided
  invoice_period_end timestamptz,
  invoiced_at timestamptz,
  refunded_at timestamptz,
  voided_at timestamptz,
  stripe_invoice_item_id text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dfy_usage_user ON public.dfy_usage_charges(user_id);
CREATE INDEX idx_dfy_usage_status ON public.dfy_usage_charges(status);

ALTER TABLE public.dfy_usage_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dfy usage"
  ON public.dfy_usage_charges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage dfy usage"
  ON public.dfy_usage_charges FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TRIGGER trg_dfy_usage_updated
  BEFORE UPDATE ON public.dfy_usage_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();