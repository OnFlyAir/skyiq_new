// Creates a Stripe Checkout session for a SkyIQ subscription in EMBEDDED mode.
// Returns { clientSecret } for the <EmbeddedCheckout> component to mount.
//
// Pricing is tiered and computed server-side from the user's enabled aircraft.
// Admin / Dev users are billing-exempt: we provision an active sub directly
// and return { bypassed: true } so the frontend can short-circuit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { stripeFetch, form, calcPriceCents, type StripeEnv } from '../_shared/stripe-gateway.ts';

interface CheckoutBody {
  cycle: 'four_weekly' | 'annual';
  return_url: string;
  environment?: StripeEnv;
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
    const env: StripeEnv = body.environment === 'live' ? 'live' : 'sandbox';
    const returnUrl = body.return_url || 'https://skiiq2.lovable.app/subscription';

    const admin = createClient(supabaseUrl, serviceKey) as any;

    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, first_name, last_name, company, role_name')
      .eq('id', user.id)
      .single();
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Billing-exempt bypass — provision active sub, no checkout needed.
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

      return new Response(JSON.stringify({ bypassed: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: aircraft } = await admin
      .from('aircrafts')
      .select('id')
      .eq('user_company', user.id)
      .eq('is_enabled', true);
    const aircraftCount = aircraft?.length ?? 0;
    const amountCents = calcPriceCents(aircraftCount, cycle);

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
      }, env);
      customerId = customer.id;
    }

    const isFirstTrial = !existingSub || existingSub.status === 'trial' || existingSub.status === 'canceled';

    let sessionParams: Record<string, string | number>;

    if (isFirstTrial) {
      // First-time trial: ONE-TIME $1 charge only.
      // We deliberately do NOT create a Stripe subscription here. Creating
      // both a one-time line item AND a recurring subscription in the same
      // Checkout session caused customers to see TWO separate charges /
      // bank descriptors (e.g. "skyIQ LLC $1.00" and "LLC $1") for what
      // is supposed to be a single $1 trial activation.
      //
      // The recurring subscription is created later — inside the app —
      // once the user has added aircraft and chosen a billing cycle. The
      // payment method collected here is saved on the customer
      // (setup_future_usage=off_session) so we can charge the subscription
      // off-session at trial end without prompting again.
      sessionParams = {
        mode: 'payment',
        ui_mode: 'embedded_page',
        customer: customerId!,
        return_url: `${returnUrl}?checkout=return&session_id={CHECKOUT_SESSION_ID}`,
        'line_items[0][quantity]': 1,
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': 'SkyIQ — $1 trial (4 weeks)',
        'line_items[0][price_data][product_data][description]':
          'One-time $1 charge for your 4-week trial. After the trial, billing is $100–$200 per tail/month based on the number of aircraft in your fleet. Cancel anytime.',
        'line_items[0][price_data][unit_amount]': 100,
        'payment_intent_data[setup_future_usage]': 'off_session',
        'payment_intent_data[metadata][user_id]': user.id,
        'payment_intent_data[metadata][purpose]': 'trial_activation',
        'metadata[user_id]': user.id,
        'metadata[cycle]': cycle,
        'metadata[aircraft_count]': aircraftCount,
        'metadata[purpose]': 'trial_activation',
      };
    } else {
      // Returning user upgrading to a real recurring plan.
      // Recurring subs MUST have aircraft on file — otherwise pricing is
      // meaningless and Stripe would show a misleading $1/yr line item.
      if (aircraftCount <= 0) {
        return new Response(JSON.stringify({
          error: 'Please add at least one aircraft to your fleet before activating a recurring subscription.',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const intervalParams = cycle === 'annual'
        ? { 'line_items[0][price_data][recurring][interval]': 'year',
            'line_items[0][price_data][recurring][interval_count]': 1 }
        : { 'line_items[0][price_data][recurring][interval]': 'day',
            'line_items[0][price_data][recurring][interval_count]': 28 };

      // Human-readable per-tail breakdown so the customer sees exactly how
      // their monthly / annual price was calculated.
      const dollars = (cents: number) => (cents / 100).toFixed(2);
      const fourWeeklyCents = calcPriceCents(aircraftCount, 'four_weekly');
      const annualCents = calcPriceCents(aircraftCount, 'annual');
      const planName = cycle === 'annual'
        ? `SkyIQ Annual — ${aircraftCount} aircraft`
        : `SkyIQ 4-Weekly — ${aircraftCount} aircraft`;
      const planDescription = cycle === 'annual'
        ? `$${dollars(annualCents)} per year for ${aircraftCount} aircraft (20% annual discount). Equivalent to $${dollars(fourWeeklyCents)} every 4 weeks.`
        : `$${dollars(fourWeeklyCents)} every 4 weeks for ${aircraftCount} aircraft. Switch to annual anytime to save 20%.`;

      sessionParams = {
        mode: 'subscription',
        ui_mode: 'embedded_page',
        customer: customerId!,
        return_url: `${returnUrl}?checkout=return&session_id={CHECKOUT_SESSION_ID}`,
        'line_items[0][quantity]': 1,
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': planName,
        'line_items[0][price_data][product_data][description]': planDescription,
        'line_items[0][price_data][unit_amount]': amountCents,
        ...intervalParams,
        'metadata[user_id]': user.id,
        'metadata[cycle]': cycle,
        'metadata[aircraft_count]': aircraftCount,
        'subscription_data[metadata][user_id]': user.id,
        'subscription_data[metadata][cycle]': cycle,
        'subscription_data[metadata][aircraft_count]': aircraftCount,
      };
    }

    const session = await stripeFetch('/v1/checkout/sessions', {
      method: 'POST',
      body: form(sessionParams),
    }, env);

    await admin.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      status: existingSub?.status ?? 'trial',
      billing_cycle: cycle,
      aircraft_count: aircraftCount,
      monthly_amount_cents: amountCents,
    } as any, { onConflict: 'user_id' });

    return new Response(JSON.stringify({
      clientSecret: session.client_secret,
      bypassed: false,
    }), {
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
