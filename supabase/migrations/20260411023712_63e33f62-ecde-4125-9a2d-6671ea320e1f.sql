-- Enums
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_cycle AS ENUM ('four_weekly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  quickbooks_customer_id TEXT,
  quickbooks_invoice_id TEXT,
  status subscription_status NOT NULL DEFAULT 'trial',
  billing_cycle billing_cycle NOT NULL DEFAULT 'four_weekly',
  trial_starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  aircraft_count INTEGER NOT NULL DEFAULT 0,
  monthly_amount_cents INTEGER NOT NULL DEFAULT 100,
  trial_reminder_sent BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "Admins can update all subscriptions"
  ON public.subscriptions FOR UPDATE TO authenticated USING (is_admin());

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Pricing function: $200/plane for 1-4, $150/plane for 5-9, $100/plane for 10+
CREATE OR REPLACE FUNCTION public.calculate_subscription_price(plane_count INTEGER)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE total INTEGER := 0;
BEGIN
  IF plane_count <= 0 THEN RETURN 0; END IF;
  IF plane_count >= 4 THEN total := 4 * 20000;
  ELSE RETURN plane_count * 20000; END IF;
  IF plane_count >= 9 THEN total := total + 5 * 15000;
  ELSIF plane_count > 4 THEN RETURN total + (plane_count - 4) * 15000; END IF;
  IF plane_count > 9 THEN total := total + (plane_count - 9) * 10000; END IF;
  RETURN total;
END; $$;