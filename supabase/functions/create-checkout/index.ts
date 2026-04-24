// Creates a Stripe Checkout session for a SkyIQ subscription.
// - Admin / Dev users are bypassed entirely (no charge).
// - $1 / 30-day trial on first signup, then auto-converts to chosen cycle.
// - Aircraft count is read server-side from the user's fleet.
// - Cycle: 'four_weekly' (28 days, paid each cycle) or 'annual' (20% off).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/stripe';

interface CheckoutBody {
  cycle: 'four_weekly' | 'annual';
  return_url: string;
}

function calcPriceCents(count: number, cycle: 'four_weekly' | 'annual'): number {
  if (count <= 0) return 100; // $1 trial floor
  let perCycle = 0;
  const tier1 = Math.min(count, 4);
  perCycle += tier1 * 20000;
  if (count > 4) perCycle += Math.min(count - 4, 5) * 15000;
  if (count > 9) perCycle += (count - 9) * 10000;
  if (cycle === 'annual') {
    // 13 four-week cycles per year, 20% off
    return Math.round(perCycle * 13 * 0.8);
  }
  return perCycle;
}

async function stripeFetch(path: string, init: RequestInit = {}) {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const stripeKey = Deno.env.get('STRIPE_SANDBOX_API_KEY') ?? Deno.env.get('STRIPE_API_KEY');
  if (!lovableKey) throw new Error('LOVABLE_API_KEY missing');
  if (!stripeKey) throw new Error('STRIPE_API_KEY missing');

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': stripeKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${text}`);
  return JSON.parse(text);
}

function form(obj: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) p.append(k, String(v));
  }
  return p.toString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as CheckoutBody;
    const cycle = body.cycle === 'annual' ? 'annual' : 'four_weekly';
    const returnUrl = body.return_url || 'https://skiiq2.lovable.app/subscription';

    const admin = createClient(supabaseUrl, serviceKey);

    // Profile / role check
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, first_name, last_name, company, role_name, is_billing_manager')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // BYPASS: Admin & Dev never get charged. Provision an active sub directly.
    if (profile.role_name === 'Admin' || profile.role_name === 'Dev') {
      const farFuture = new Date('2099-12-31').toISOString();
      await admin.from('subscriptions').upsert({
        user_id: user.id,
        status: 'active',
        billing_cycle: cycle,
        aircraft_count: 0,
        monthly_amount_cents: 0,
        trial_starts_at: new Date().toISOString(),
        trial_ends_at: farFuture,
        current_period_start: new Date().toISOString(),
        current_period_end: farFuture,
      } as any, { onConflict: 'user_id' });

      return new Response(JSON.stringify({ bypassed: true, url: returnUrl }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Aircraft count for this company
    const { data: aircraft } = await admin
      .from('aircrafts')
      .select('id')
      .eq('user_company', user.id)
      .eq('is_enabled', true);
    const aircraftCount = aircraft?.length ?? 0;

    const amountCents = calcPriceCents(aircraftCount, cycle);

    // Existing subscription / Stripe customer
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeFetch('/v1/customers', {
        method: 'POST',
        body: form({
          email: profile.email,
          name: `${profile.first_name} ${profile.last_name}`.trim() || profile.email,
          'metadata[user_id]': user.id,
          'metadata[company]': profile.company ?? '',
        }),
      });
      customerId = customer.id;
    }

    // Build a Stripe Checkout Session for subscription with $1 trial.
    // Use price_data so we can set the exact tiered total per cycle.
    const isFirstTrial = !existingSub || existingSub.status === 'trial';
    const intervalParams = cycle === 'annual'
      ? { 'line_items[0][price_data][recurring][interval]': 'year',
          'line_items[0][price_data][recurring][interval_count]': 1 }
      : { 'line_items[0][price_data][recurring][interval]': 'day',
          'line_items[0][price_data][recurring][interval_count]': 28 };

    const sessionParams: Record<string, string | number> = {
      mode: 'subscription',
      customer: customerId!,
      success_url: `${returnUrl}?checkout=success`,
      cancel_url: `${returnUrl}?checkout=cancel`,
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]':
        cycle === 'annual' ? 'SkyIQ — Annual' : 'SkyIQ — 4-Week',
      'line_items[0][price_data][unit_amount]': amountCents,
      ...intervalParams,
      'metadata[user_id]': user.id,
      'metadata[cycle]': cycle,
      'metadata[aircraft_count]': aircraftCount,
    };

    if (isFirstTrial) {
      // Charge $1 today, then full amount at end of 30-day trial
      sessionParams['subscription_data[trial_period_days]'] = 30;
      sessionParams['payment_method_collection'] = 'always';
    }

    const session = await stripeFetch('/v1/checkout/sessions', {
      method: 'POST',
      body: form(sessionParams),
    });

    // Persist customer id + pending state
    await admin.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      status: existingSub?.status ?? 'trial',
      billing_cycle: cycle,
      aircraft_count: aircraftCount,
      monthly_amount_cents: amountCents,
    } as any, { onConflict: 'user_id' });

    return new Response(JSON.stringify({ url: session.url, bypassed: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('create-checkout error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
