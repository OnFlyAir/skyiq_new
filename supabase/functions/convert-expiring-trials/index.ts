// Daily cron — converts finished $1 trials into real recurring Stripe
// subscriptions priced from the account's enabled fleet.
//
// Tiers (stepped, per tail, per 4-week cycle):
//   planes 1-3 -> $200 each, 4-6 -> $150 each, 7+ -> $100 each
//
// Idempotent: only touches rows where status = 'trial', the trial end date
// has passed, and no Stripe subscription exists yet. Safe to re-run.
//
// Auth: requires the CRON_SECRET shared secret (x-cron-secret header or
// Authorization: Bearer <secret>).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { sendBillingEmail } from '../_shared/billing-emails.ts';
import { stripeFetch, form, calcPriceCents, type StripeEnv } from '../_shared/stripe-gateway.ts';

interface Body {
  environment?: StripeEnv;
  user_id?: string; // optional: convert a single account now
  dry_run?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) return json({ error: 'CRON_SECRET not configured' }, 500);
  const provided =
    req.headers.get('x-cron-secret') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (provided !== cronSecret) return json({ error: 'Unauthorized' }, 401);

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const env: StripeEnv = body.environment === 'sandbox' ? 'sandbox' : 'live';
    const dryRun = body.dry_run === true;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    ) as any;

    let query = supabase
      .from('subscriptions')
      .select('user_id, billing_cycle, trial_ends_at, stripe_customer_id, stripe_subscription_id, status')
      .eq('status', 'trial')
      .is('stripe_subscription_id', null)
      .lte('trial_ends_at', new Date().toISOString());

    if (body.user_id) query = query.eq('user_id', body.user_id);

    const { data: due, error } = await query;
    if (error) throw error;

    const rows = (due ?? []) as any[];
    const results: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const userId = row.user_id as string;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, first_name, role_name, billing_exempt')
          .eq('id', userId)
          .maybeSingle();

        if (!profile) {
          results.push({ userId, outcome: 'skipped_no_profile' });
          continue;
        }
        if (['Admin', 'Dev'].includes(profile.role_name) || profile.billing_exempt === true) {
          results.push({ userId, outcome: 'skipped_exempt' });
          continue;
        }

        const { data: aircraft } = await supabase
          .from('aircrafts')
          .select('id')
          .eq('user_company', userId)
          .eq('is_enabled', true);
        const count = aircraft?.length ?? 0;

        // No fleet on file — we can't price the plan. Block access until they
        // add aircraft and activate from the subscription page. No charge.
        if (count <= 0) {
          if (!dryRun) {
            await supabase.from('subscriptions')
              .update({ status: 'past_due' })
              .eq('user_id', userId);
            await supabase.from('profiles')
              .update({ is_enabled: false })
              .eq('id', userId);
          }
          results.push({ userId, outcome: 'blocked_no_aircraft' });
          continue;
        }

        const customerId = row.stripe_customer_id as string | null;
        if (!customerId) {
          if (!dryRun) {
            await supabase.from('subscriptions').update({ status: 'past_due' }).eq('user_id', userId);
            await supabase.from('profiles').update({ is_enabled: false }).eq('id', userId);
          }
          results.push({ userId, outcome: 'blocked_no_customer' });
          continue;
        }

        const cycle = (row.billing_cycle === 'annual' ? 'annual' : 'four_weekly') as
          'four_weekly' | 'annual';
        const amount = calcPriceCents(count, cycle);

        if (dryRun) {
          results.push({ userId, outcome: 'would_convert', count, amount, cycle });
          continue;
        }

        // Make sure a saved card is on file as the customer default.
        const customer = await stripeFetch(`/v1/customers/${customerId}`, { method: 'GET' }, env);
        let defaultPm: string | null = customer?.invoice_settings?.default_payment_method ?? null;
        if (!defaultPm) {
          const pms = await stripeFetch(
            `/v1/payment_methods?customer=${customerId}&type=card&limit=1`,
            { method: 'GET' },
            env,
          );
          defaultPm = pms?.data?.[0]?.id ?? null;
          if (defaultPm) {
            await stripeFetch(`/v1/customers/${customerId}`, {
              method: 'POST',
              body: form({ 'invoice_settings[default_payment_method]': defaultPm }),
            }, env);
          }
        }

        if (!defaultPm) {
          await supabase.from('subscriptions').update({ status: 'past_due' }).eq('user_id', userId);
          await supabase.from('profiles').update({ is_enabled: false }).eq('id', userId);
          await sendBillingEmail({
            to: profile.email,
            type: 'payment_failed',
            userId,
            data: { firstName: profile.first_name, amount },
          });
          results.push({ userId, outcome: 'blocked_no_card' });
          continue;
        }

        const intervalParams = cycle === 'annual'
          ? { 'items[0][price_data][recurring][interval]': 'year',
              'items[0][price_data][recurring][interval_count]': 1 }
          : { 'items[0][price_data][recurring][interval]': 'day',
              'items[0][price_data][recurring][interval_count]': 28 };

        const planName = cycle === 'annual'
          ? `SkyIQ Annual — ${count} aircraft`
          : `SkyIQ 4-Weekly — ${count} aircraft`;

        const subscription = await stripeFetch('/v1/subscriptions', {
          method: 'POST',
          body: form({
            customer: customerId,
            default_payment_method: defaultPm,
            off_session: true,
            'items[0][price_data][currency]': 'usd',
            'items[0][price_data][product_data][name]': planName,
            'items[0][price_data][unit_amount]': amount,
            ...intervalParams,
            'metadata[user_id]': userId,
            'metadata[cycle]': cycle,
            'metadata[aircraft_count]': String(count),
          }),
        }, env);

        await supabase.from('subscriptions').update({
          stripe_subscription_id: subscription.id,
          status: subscription.status === 'active' ? 'active' : 'past_due',
          aircraft_count: count,
          monthly_amount_cents: amount,
          current_period_start: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000).toISOString() : null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        }).eq('user_id', userId);

        if (subscription.status === 'active' || subscription.status === 'trialing') {
          await supabase.from('profiles').update({ is_enabled: true }).eq('id', userId);
          await sendBillingEmail({
            to: profile.email,
            type: 'plan_changed',
            userId,
            data: {
              firstName: profile.first_name,
              billingCycle: cycle,
              amount,
              aircraftCount: count,
              nextRenewal: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toLocaleDateString()
                : undefined,
            },
          });
        } else {
          await supabase.from('profiles').update({ is_enabled: false }).eq('id', userId);
        }

        results.push({
          userId,
          outcome: 'converted',
          count,
          amount,
          cycle,
          stripeStatus: subscription.status,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[convert-expiring-trials] ${userId} failed:`, msg);
        results.push({ userId, outcome: 'error', error: msg });
      }
    }

    return json({ checked: rows.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown';
    console.error('[convert-expiring-trials] error:', message);
    return json({ error: message }, 500);
  }
});
