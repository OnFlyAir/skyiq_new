// Stripe webhook handler — receives subscription lifecycle events from the
// Lovable-connected Stripe account and syncs them into the `subscriptions` table.
// URL: /functions/v1/payments-webhook?env=sandbox|live
//
// Security: verifies HMAC-SHA256 signature using PAYMENTS_{SANDBOX|LIVE}_WEBHOOK_SECRET.
//
// Side effects:
//   - Toggles profiles.is_enabled on past_due / canceled / active transitions.
//     Admin / Dev never get disabled (billing-exempt).
//   - Sends transactional billing emails (trial start, payment failed, canceled, plan changed).
//   - On invoice.paid (renewal), applies subscriptions.pending_billing_cycle if set, by
//     updating the Stripe subscription to the new cycle.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { sendBillingEmail, type BillingEmailType } from '../_shared/billing-emails.ts';
import {
  verifyAndParseWebhook,
  stripeFetch,
  form,
  calcPriceCents,
  type StripeEnv,
} from '../_shared/stripe-gateway.ts';

const EXEMPT_ROLES = ['Admin', 'Dev'];

// Use `any` for the supabase client parameter — the SDK's generic
// inference narrows the default schema to `never` under strict TS, which
// rejects downstream `.from('...')` calls. We don't need the inference here.
type AnyClient = any;

async function setUserEnabled(
  supabase: AnyClient,
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role_name, is_enabled')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return;
  if (!enabled && EXEMPT_ROLES.includes((profile as any).role_name)) return;
  if ((profile as any).is_enabled !== enabled) {
    await supabase.from('profiles').update({ is_enabled: enabled } as any).eq('id', userId);
  }
}

async function safeSendEmail(
  supabase: AnyClient,
  userId: string,
  type: BillingEmailType,
  extraData: Record<string, any> = {},
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, first_name, role_name')
    .eq('id', userId)
    .maybeSingle();
  if (!profile || !(profile as any).email) return;
  if (EXEMPT_ROLES.includes((profile as any).role_name)) return;
  await sendBillingEmail({
    to: (profile as any).email,
    type,
    userId,
    data: { firstName: (profile as any).first_name, ...extraData },
  });
}

function mapStatus(s: string): string {
  switch (s) {
    case 'trialing': return 'trial';
    case 'active': return 'active';
    case 'past_due':
    case 'unpaid': return 'past_due';
    case 'canceled': return 'canceled';
    case 'incomplete_expired':
    case 'expired': return 'expired';
    default: return s || 'trial';
  }
}

// If the user has a pending_billing_cycle different from the current one, push
// it to Stripe now (at the start of a new billing period, i.e. invoice.paid).
async function maybeApplyPendingCycle(
  supabase: AnyClient,
  env: StripeEnv,
  userId: string,
  stripeSubscriptionId: string,
) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('pending_billing_cycle, billing_cycle, aircraft_count')
    .eq('user_id', userId)
    .maybeSingle();
  if (!sub) return;
  const pending = (sub as any).pending_billing_cycle as 'four_weekly' | 'annual' | null;
  const current = (sub as any).billing_cycle as 'four_weekly' | 'annual';
  if (!pending || pending === current) return;

  const count = (sub as any).aircraft_count ?? 0;
  const newAmount = calcPriceCents(count, pending);

  // Retrieve current subscription to find the single item id we need to replace.
  const current_sub = await stripeFetch(`/v1/subscriptions/${stripeSubscriptionId}`, { method: 'GET' }, env);
  const itemId = current_sub.items?.data?.[0]?.id;
  if (!itemId) return;

  // Replace the line item with new price_data for the new cycle.
  const intervalParams = pending === 'annual'
    ? { 'items[0][price_data][recurring][interval]': 'year',
        'items[0][price_data][recurring][interval_count]': 1 }
    : { 'items[0][price_data][recurring][interval]': 'day',
        'items[0][price_data][recurring][interval_count]': 28 };

  await stripeFetch(`/v1/subscriptions/${stripeSubscriptionId}`, {
    method: 'POST',
    body: form({
      'items[0][id]': itemId,
      'items[0][price_data][currency]': 'usd',
      'items[0][price_data][product_data][name]':
        pending === 'annual' ? 'SkyIQ — Annual' : 'SkyIQ — 4-Week',
      'items[0][price_data][unit_amount]': newAmount,
      ...intervalParams,
      proration_behavior: 'none',
      'metadata[cycle]': pending,
    }),
  }, env);

  await supabase.from('subscriptions').update({
    billing_cycle: pending,
    pending_billing_cycle: null,
    monthly_amount_cents: newAmount,
  } as any).eq('user_id', userId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const env: StripeEnv = url.searchParams.get('env') === 'live' ? 'live' : 'sandbox';

    const { event } = await verifyAndParseWebhook(req, env);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const type: string = event.type ?? '';
    const obj = event.data?.object ?? {};
    console.log(`[payments-webhook] ${type}`);

    // Log every incoming event up front. We'll update status after processing.
    const logUserId =
      obj.metadata?.user_id ?? obj.subscription_details?.metadata?.user_id ?? null;
    const logCustomer = obj.customer ?? obj.customer_id ?? null;
    const logSubId = obj.id?.startsWith?.('sub_')
      ? obj.id
      : (obj.subscription ?? obj.subscription_id ?? null);
    const logAmount =
      obj.amount_due ?? obj.amount_paid ?? obj.amount ??
      obj.items?.data?.[0]?.price?.unit_amount ?? null;

    const { data: logRow } = await supabase
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: event.id ?? null,
        event_type: type,
        environment: env,
        status: 'received',
        user_id: logUserId,
        stripe_customer_id: logCustomer,
        stripe_subscription_id: logSubId,
        amount_cents: typeof logAmount === 'number' ? logAmount : null,
        payload: event,
      } as any)
      .select('id')
      .maybeSingle();
    const logId = (logRow as any)?.id as string | undefined;

    let processError: string | null = null;
    try {

    switch (type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'subscription.created':
      case 'subscription.updated': {
        const userId = obj.metadata?.user_id;
        if (!userId) break;

        const newStatus = mapStatus(obj.status);
        const cycle = obj.metadata?.cycle === 'annual' ? 'annual' : 'four_weekly';
        const amount = obj.items?.data?.[0]?.price?.unit_amount ?? 0;
        const periodEndIso = obj.current_period_end
          ? new Date(obj.current_period_end * 1000).toISOString() : null;
        const cancelAtPeriodEnd = !!obj.cancel_at_period_end;

        const { data: prior } = await supabase
          .from('subscriptions')
          .select('status, billing_cycle, aircraft_count, monthly_amount_cents')
          .eq('user_id', userId)
          .maybeSingle();

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: obj.id,
          stripe_customer_id: obj.customer,
          status: cancelAtPeriodEnd ? 'canceled' : newStatus,
          billing_cycle: cycle,
          monthly_amount_cents: amount,
          current_period_start: obj.current_period_start
            ? new Date(obj.current_period_start * 1000).toISOString() : null,
          current_period_end: periodEndIso,
          canceled_at: obj.canceled_at
            ? new Date(obj.canceled_at * 1000).toISOString() : null,
        } as any, { onConflict: 'user_id' });

        if (newStatus === 'past_due') {
          await setUserEnabled(supabase, userId, false);
        } else if (newStatus === 'active' || newStatus === 'trial') {
          if (!cancelAtPeriodEnd) await setUserEnabled(supabase, userId, true);
          if (type.endsWith('.created') && newStatus === 'trial') {
            await safeSendEmail(supabase, userId, 'trial_started', {
              trialEndsAt: periodEndIso ? new Date(periodEndIso).toLocaleDateString() : undefined,
            });
          }
        }

        if (
          prior &&
          (prior as any).status !== 'trial' &&
          ((prior as any).billing_cycle !== cycle || (prior as any).monthly_amount_cents !== amount)
        ) {
          await safeSendEmail(supabase, userId, 'plan_changed', {
            billingCycle: cycle,
            amount,
            aircraftCount: (prior as any).aircraft_count,
            nextRenewal: periodEndIso ? new Date(periodEndIso).toLocaleDateString() : undefined,
          });
        }
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        // Renewal: apply pending cycle switch if any.
        const userId = obj.metadata?.user_id ?? obj.subscription_details?.metadata?.user_id;
        const stripeSubId = obj.subscription ?? obj.subscription_id;
        if (userId && stripeSubId) {
          try {
            await maybeApplyPendingCycle(supabase, env, userId, stripeSubId);
          } catch (e) {
            console.error('[webhook] maybeApplyPendingCycle failed', e);
          }
        }
        break;
      }

      case 'customer.subscription.deleted':
      case 'subscription.canceled': {
        const userId = obj.metadata?.user_id;
        if (!userId) break;
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
          } as any)
          .eq('user_id', userId);
        await setUserEnabled(supabase, userId, false);
        await safeSendEmail(supabase, userId, 'subscription_canceled');
        break;
      }

      case 'invoice.payment_failed':
      case 'transaction.payment_failed': {
        const userId = obj.metadata?.user_id ?? obj.subscription_details?.metadata?.user_id;
        if (!userId) break;
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' } as any)
          .eq('user_id', userId);
        await setUserEnabled(supabase, userId, false);
        const amount = obj.amount_due ?? obj.amount ?? 0;
        await safeSendEmail(supabase, userId, 'payment_failed', { amount });
        break;
      }

      default:
        break;
    }
    } catch (procErr) {
      processError = procErr instanceof Error ? procErr.message : String(procErr);
      console.error('[webhook] processing error:', processError);
    }

    if (logId) {
      await supabase
        .from('stripe_webhook_events')
        .update({
          status: processError ? 'failed' : 'processed',
          error_message: processError,
          processed_at: new Date().toISOString(),
        } as any)
        .eq('id', logId);
    }

    return new Response(JSON.stringify({ received: true, ok: !processError }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown';
    console.error('webhook error:', message);
    // 400 on signature failures so Stripe retries correctly.
    const status = message.includes('signature') || message.includes('timestamp') ? 400 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
