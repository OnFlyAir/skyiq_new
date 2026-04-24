// Returns the authenticated user's recent Stripe invoices with PDF + hosted URLs.
// Frontend uses this to render a downloadable invoice history on the Subscription page.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { stripeFetch, type StripeEnv } from '../_shared/stripe-gateway.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

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

    const body = (await req.json().catch(() => ({}))) as { environment?: StripeEnv; limit?: number };
    const env: StripeEnv = body.environment === 'live' ? 'live' : 'sandbox';
    const limit = Math.min(Math.max(body.limit ?? 20, 1), 100);

    const admin = createClient(supabaseUrl, serviceKey) as any;
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return new Response(JSON.stringify({ invoices: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await stripeFetch(
      `/v1/invoices?customer=${encodeURIComponent(sub.stripe_customer_id)}&limit=${limit}`,
      { method: 'GET' },
      env,
    );

    type StripeInvoice = {
      id: string; number: string | null; status: string;
      amount_paid: number; amount_due: number; currency: string;
      created: number; invoice_pdf: string | null; hosted_invoice_url: string | null;
    };
    const invoices = ((result.data ?? []) as StripeInvoice[]).map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_cents: inv.amount_paid || inv.amount_due,
      currency: inv.currency,
      created: inv.created,
      pdf_url: inv.invoice_pdf,
      hosted_url: inv.hosted_invoice_url,
    }));

    return new Response(JSON.stringify({ invoices }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('list-invoices error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
