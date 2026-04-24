// Stripe webhook handler — receives subscription lifecycle events from
// Lovable's built-in payments and syncs them into the `subscriptions` table.
// Webhook URL: /functions/v1/payments-webhook?env=sandbox|live
//
// Side effects beyond the subscriptions table:
//   - Sends transactional billing emails via Resend (trial start, payment
//     failed, canceled, plan changed).
//   - Auto-disables user (profiles.is_enabled = false) immediately on
//     canceled or past_due. Auto-re-enables on active/trialing.
//   - Admin/Dev users are NEVER auto-disabled (billing-exempt).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { sendBillingEmail, type BillingEmailType } from '../_shared/billing-emails.ts';

const EXEMPT_ROLES = ['Admin', 'Dev'];

async function setUserEnabled(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  enabled: boolean,
): Promise<{ profile: any | null }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, first_name, role_name, is_enabled')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return { profile: null };
  // Never disable Admin / Dev — they're billing-exempt.
  if (!enabled && EXEMPT_ROLES.includes((profile as any).role_name)) {
    return { profile };
  }
  if ((profile as any).is_enabled !== enabled) {
    await supabase.from('profiles').update({ is_enabled: enabled } as any).eq('id', userId);
  }
  return { profile };
}

async function safeSendEmail(
  supabase: ReturnType<typeof createClient>,
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
  // Skip emails for billing-exempt roles — they're not paying.
  if (EXEMPT_ROLES.includes((profile as any).role_name)) return;
  await sendBillingEmail({
    to: (profile as any).email,
    type,
    data: { firstName: (profile as any).first_name, ...extraData },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const env = url.searchParams.get('env') ?? 'sandbox';
    const secretName = env === 'live'
      ? 'PAYMENTS_LIVE_WEBHOOK_SECRET'
      : 'PAYMENTS_SANDBOX_WEBHOOK_SECRET';
    const webhookSecret = Deno.env.get(secretName);
    if (!webhookSecret) {
      console.warn(`Webhook secret missing for env=${env}`);
    }

    const rawBody = await req.text();
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response('invalid json', { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const type: string = event.type ?? '';
    const obj = event.data?.object ?? {};
    console.log(`[payments-webhook] ${type}`);

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

        // Read prior state to detect transitions.
        const { data: prior } = await supabase
          .from('subscriptions')
          .select('status, billing_cycle, aircraft_count, monthly_amount_cents')
          .eq('user_id', userId)
          .maybeSingle();

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: obj.id,
          stripe_customer_id: obj.customer,
          status: newStatus,
          billing_cycle: cycle,
          monthly_amount_cents: amount,
          current_period_start: obj.current_period_start
            ? new Date(obj.current_period_start * 1000).toISOString() : null,
          current_period_end: periodEndIso,
          canceled_at: obj.canceled_at
            ? new Date(obj.canceled_at * 1000).toISOString() : null,
        } as any, { onConflict: 'user_id' });

        // Side effects driven by status transitions
        if (newStatus === 'past_due') {
          await setUserEnabled(supabase, userId, false);
          // payment_failed event also fires below; don't double-send here.
        } else if (newStatus === 'active' || newStatus === 'trial') {
          // Recovery — re-enable user
          await setUserEnabled(supabase, userId, true);
          if (type.endsWith('.created') && newStatus === 'trial') {
            await safeSendEmail(supabase, userId, 'trial_started', {
              trialEndsAt: periodEndIso ? new Date(periodEndIso).toLocaleDateString() : undefined,
            });
          }
        }

        // Detect plan change (cycle or amount changed) — send confirmation
        if (
          prior &&
          (prior as any).status !== 'trial' &&
          ((prior as any).billing_cycle !== cycle || (prior as any).monthly_amount_cents !== amount)
        ) {
          await safeSendEmail(supabase, userId, 'plan_changed', {
            billingCycle: cycle,
            amount,
            nextRenewal: periodEndIso ? new Date(periodEndIso).toLocaleDateString() : undefined,
          });
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

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown';
    console.error('webhook error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function mapStatus(s: string): string {
  switch (s) {
    case 'trialing': return 'trial';
    case 'active': return 'active';
    case 'past_due': case 'unpaid': return 'past_due';
    case 'canceled': return 'canceled';
    case 'incomplete_expired': case 'expired': return 'expired';
    default: return s || 'trial';
  }
}
