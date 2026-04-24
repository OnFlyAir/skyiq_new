// Called after a user adds/removes an aircraft (or toggles is_enabled).
// Recomputes the subscription amount and updates the Stripe subscription
// inline with prorated billing. Skips if no Stripe subscription exists yet
// (e.g. still in pre-checkout trial DB row).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { stripeFetch, form, calcPriceCents, type StripeEnv } from '../_shared/stripe-gateway.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const body = await req.json().catch(() => ({}));
    const env: StripeEnv = body.environment === 'live' ? 'live' : 'sandbox';

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    ) as any;

    const [{ data: aircraft }, { data: sub }, { data: profile }] = await Promise.all([
      admin.from('aircrafts').select('id').eq('user_company', user.id).eq('is_enabled', true),
      admin.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
      admin.from('profiles').select('role_name').eq('id', user.id).maybeSingle(),
    ]);

    // Admin/Dev: nothing to sync in Stripe.
    if (profile?.role_name === 'Admin' || profile?.role_name === 'Dev') {
      await admin.from('subscriptions').update({ aircraft_count: aircraft?.length ?? 0 } as any)
        .eq('user_id', user.id);
      return new Response(JSON.stringify({ updated: true, exempt: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const count = aircraft?.length ?? 0;
    const cycle = (sub?.billing_cycle ?? 'four_weekly') as 'four_weekly' | 'annual';
    const newAmount = calcPriceCents(count, cycle);

    // Always keep the DB row accurate.
    await admin.from('subscriptions').update({
      aircraft_count: count,
      monthly_amount_cents: newAmount,
    } as any).eq('user_id', user.id);

    // No Stripe sub yet (still in pre-checkout state) — DB update is enough.
    if (!sub?.stripe_subscription_id) {
      return new Response(JSON.stringify({ updated: true, stripe: false, count, amount: newAmount }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // On trial, don't mutate Stripe — trial charge is fixed.
    if (sub.status === 'trial') {
      return new Response(JSON.stringify({ updated: true, stripe: false, trial: true, count }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update Stripe subscription with prorated billing.
    const current_sub = await stripeFetch(`/v1/subscriptions/${sub.stripe_subscription_id}`, { method: 'GET' }, env);
    const itemId = current_sub.items?.data?.[0]?.id;
    if (!itemId) throw new Error('subscription has no items');

    const intervalParams = cycle === 'annual'
      ? { 'items[0][price_data][recurring][interval]': 'year',
          'items[0][price_data][recurring][interval_count]': 1 }
      : { 'items[0][price_data][recurring][interval]': 'day',
          'items[0][price_data][recurring][interval_count]': 28 };

    await stripeFetch(`/v1/subscriptions/${sub.stripe_subscription_id}`, {
      method: 'POST',
      body: form({
        'items[0][id]': itemId,
        'items[0][price_data][currency]': 'usd',
        'items[0][price_data][product_data][name]':
          cycle === 'annual' ? 'SkyIQ — Annual' : 'SkyIQ — 4-Week',
        'items[0][price_data][unit_amount]': newAmount,
        ...intervalParams,
        proration_behavior: 'always_invoice',
        'metadata[aircraft_count]': String(count),
      }),
    }, env);

    return new Response(JSON.stringify({ updated: true, stripe: true, count, amount: newAmount }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown';
    console.error('sync-subscription-billing error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
