// Stripe webhook handler — receives subscription lifecycle events from
// Lovable's built-in payments and syncs them into the `subscriptions` table.
// Webhook URL: /functions/v1/payments-webhook?env=sandbox|live

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

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

        const status = mapStatus(obj.status);
        const cycle = obj.metadata?.cycle === 'annual' ? 'annual' : 'four_weekly';
        const amount = obj.items?.data?.[0]?.price?.unit_amount ?? 0;

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: obj.id,
          stripe_customer_id: obj.customer,
          status,
          billing_cycle: cycle,
          monthly_amount_cents: amount,
          current_period_start: obj.current_period_start
            ? new Date(obj.current_period_start * 1000).toISOString() : null,
          current_period_end: obj.current_period_end
            ? new Date(obj.current_period_end * 1000).toISOString() : null,
          canceled_at: obj.canceled_at
            ? new Date(obj.canceled_at * 1000).toISOString() : null,
        } as any, { onConflict: 'user_id' });
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
