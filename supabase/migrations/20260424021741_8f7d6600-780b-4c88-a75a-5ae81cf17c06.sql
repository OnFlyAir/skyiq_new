-- Billing email log: tracks every billing email send attempt and surfaces failures to admins.
CREATE TABLE public.billing_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  recipient_email text NOT NULL,
  email_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed')),
  error_message text,
  provider_response text,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_email_log_status ON public.billing_email_log(status, created_at DESC);
CREATE INDEX idx_billing_email_log_unack ON public.billing_email_log(acknowledged, created_at DESC) WHERE status = 'failed';
CREATE INDEX idx_billing_email_log_user ON public.billing_email_log(user_id);

ALTER TABLE public.billing_email_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view or manage billing email logs.
CREATE POLICY "Admins can view billing email log"
  ON public.billing_email_log FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update billing email log"
  ON public.billing_email_log FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Edge functions use the service role and bypass RLS, so no INSERT policy is needed
-- for them. We don't allow client-side inserts.
