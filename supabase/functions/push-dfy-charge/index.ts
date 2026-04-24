// Push a pending dfy_usage_charges row onto the user's Stripe customer as an
// invoice item. Stripe automatically rolls pending invoice items into the
// next subscription renewal invoice — no extra scheduling needed.
//
// Called from AdminDfyPage right after status flips to "sent" and the
// pending_invoice row is upserted. Idempotent on (request_id).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { stripeFetch, form, type StripeEnv } from '../_shared/stripe-gateway.ts';

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
    const { request_id } = body as { request_id?: string };
    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const env: StripeEnv = body.environment === 'live' ? 'live' : 'sandbox';

    // Verify caller is an admin
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

    const { data: caller } = await admin.from('profiles').select('role_name').eq('id', user.id).maybeSingle();
    if (caller?.role_name !== 'Admin' && caller?.role_name !== 'Dev') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load the pending charge
    const { data: charge } = await admin
      .from('dfy_usage_charges')
      .select('*')
      .eq('request_id', request_id)
      .maybeSingle();
    if (!charge) {
      return new Response(JSON.stringify({ error: 'charge not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (charge.status === 'invoiced' && charge.stripe_invoice_item_id) {
      return new Response(JSON.stringify({ ok: true, already: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (charge.status !== 'pending_invoice') {
      return new Response(JSON.stringify({ error: `cannot push charge in status ${charge.status}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up Stripe customer + sub for the user
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', charge.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'no Stripe customer for user' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create the invoice item — Stripe auto-attaches to next renewal invoice
    const params: Record<string, string | number> = {
      customer: sub.stripe_customer_id,
      amount: charge.amount_cents,
      currency: 'usd',
      description: charge.description || 'Fuel Planning (DFY)',
      'metadata[dfy_request_id]': request_id,
      'metadata[dfy_charge_id]': charge.id,
    };
    if (sub.stripe_subscription_id) {
      params.subscription = sub.stripe_subscription_id;
    }

    const invoiceItem = await stripeFetch('/v1/invoiceitems', {
      method: 'POST',
      body: form(params),
    }, env);

    await admin.from('dfy_usage_charges').update({
      status: 'invoiced',
      stripe_invoice_item_id: invoiceItem.id,
      invoiced_at: new Date().toISOString(),
    }).eq('id', charge.id);

    return new Response(JSON.stringify({ ok: true, invoice_item_id: invoiceItem.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown';
    console.error('push-dfy-charge error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
