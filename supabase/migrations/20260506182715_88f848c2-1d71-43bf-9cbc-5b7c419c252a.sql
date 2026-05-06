
-- 1) SUBSCRIPTIONS: remove permissive user INSERT/UPDATE, replace UPDATE with field-locked version
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;

CREATE POLICY "Users can update own subscription (cycle only)"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status                  IS NOT DISTINCT FROM (SELECT s.status                  FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND stripe_customer_id      IS NOT DISTINCT FROM (SELECT s.stripe_customer_id      FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND stripe_subscription_id  IS NOT DISTINCT FROM (SELECT s.stripe_subscription_id  FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND stripe_price_id         IS NOT DISTINCT FROM (SELECT s.stripe_price_id         FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND quickbooks_customer_id  IS NOT DISTINCT FROM (SELECT s.quickbooks_customer_id  FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND quickbooks_invoice_id   IS NOT DISTINCT FROM (SELECT s.quickbooks_invoice_id   FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND monthly_amount_cents    IS NOT DISTINCT FROM (SELECT s.monthly_amount_cents    FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND aircraft_count          IS NOT DISTINCT FROM (SELECT s.aircraft_count          FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND billing_cycle           IS NOT DISTINCT FROM (SELECT s.billing_cycle           FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND trial_starts_at         IS NOT DISTINCT FROM (SELECT s.trial_starts_at         FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND trial_ends_at           IS NOT DISTINCT FROM (SELECT s.trial_ends_at           FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND trial_reminder_sent     IS NOT DISTINCT FROM (SELECT s.trial_reminder_sent     FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND current_period_start    IS NOT DISTINCT FROM (SELECT s.current_period_start    FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND current_period_end      IS NOT DISTINCT FROM (SELECT s.current_period_end      FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND canceled_at             IS NOT DISTINCT FROM (SELECT s.canceled_at             FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND created_at              IS NOT DISTINCT FROM (SELECT s.created_at              FROM public.subscriptions s WHERE s.id = subscriptions.id)
  AND user_id                 IS NOT DISTINCT FROM (SELECT s.user_id                 FROM public.subscriptions s WHERE s.id = subscriptions.id)
);

-- 2) DFY_CLIENTS: lock pricing/status fields on user UPDATE
DROP POLICY IF EXISTS "Users can update own dfy_client record" ON public.dfy_clients;

CREATE POLICY "Users can update own dfy_client (contact only)"
ON public.dfy_clients
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND pricing_tier         IS NOT DISTINCT FROM (SELECT d.pricing_tier         FROM public.dfy_clients d WHERE d.id = dfy_clients.id)
  AND per_trip_rate_cents  IS NOT DISTINCT FROM (SELECT d.per_trip_rate_cents  FROM public.dfy_clients d WHERE d.id = dfy_clients.id)
  AND monthly_rate_cents   IS NOT DISTINCT FROM (SELECT d.monthly_rate_cents   FROM public.dfy_clients d WHERE d.id = dfy_clients.id)
  AND status               IS NOT DISTINCT FROM (SELECT d.status               FROM public.dfy_clients d WHERE d.id = dfy_clients.id)
  AND user_id              IS NOT DISTINCT FROM (SELECT d.user_id              FROM public.dfy_clients d WHERE d.id = dfy_clients.id)
);

-- Also lock pricing fields on INSERT so a user can't self-provision with rate=0
DROP POLICY IF EXISTS "Users can insert own dfy_client record" ON public.dfy_clients;

CREATE POLICY "Users can insert own dfy_client (defaults only)"
ON public.dfy_clients
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND pricing_tier = 'per_trip'
  AND per_trip_rate_cents = 2500
  AND monthly_rate_cents = 1000000
  AND status = 'active'
);

-- 3) PROFILES: add billing_exempt to immutable user-update fields
DROP POLICY IF EXISTS "Users can update own profile (safe fields)" ON public.profiles;

CREATE POLICY "Users can update own profile (safe fields)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role_name           IS NOT DISTINCT FROM (SELECT p.role_name           FROM public.profiles p WHERE p.id = auth.uid())
  AND is_billing_manager  IS NOT DISTINCT FROM (SELECT p.is_billing_manager  FROM public.profiles p WHERE p.id = auth.uid())
  AND is_enabled          IS NOT DISTINCT FROM (SELECT p.is_enabled          FROM public.profiles p WHERE p.id = auth.uid())
  AND billing_exempt      IS NOT DISTINCT FROM (SELECT p.billing_exempt      FROM public.profiles p WHERE p.id = auth.uid())
);
