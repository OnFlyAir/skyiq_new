// Admin-only test endpoint: sends one of each billing email type to a recipient
// so templates and delivery can be verified end-to-end.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { sendBillingEmail, type BillingEmailType } from '../_shared/billing-emails.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdminData } = await adminClient.rpc('is_admin');
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: 'forbidden — admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: { to?: string } = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const to = (body.to || userData.user.email || '').trim();
    if (!to || !/.+@.+\..+/.test(to)) {
      return new Response(JSON.stringify({ error: 'invalid recipient' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString();
    const nextRenewal = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toLocaleDateString();

    const tests: Array<{ type: BillingEmailType; data: Record<string, any> }> = [
      { type: 'trial_started', data: { firstName: 'Test', trialEndsAt } },
      { type: 'trial_ending', data: { firstName: 'Test', trialEndsAt, amount: 5000 } },
      { type: 'payment_failed', data: { amount: 5000 } },
      { type: 'subscription_canceled', data: {} },
      { type: 'plan_changed', data: { aircraftCount: 3, billingCycle: 'annual', amount: 144000, nextRenewal } },
    ];

    const results: Array<{ type: string; ok: boolean; error?: string }> = [];
    for (const t of tests) {
      const r = await sendBillingEmail({ to, type: t.type, data: t.data, userId: userData.user.id });
      results.push({ type: t.type, ok: r.ok, error: r.error });
      // small delay to avoid burst rate limiting
      await new Promise((res) => setTimeout(res, 400));
    }

    const allOk = results.every((r) => r.ok);
    return new Response(JSON.stringify({ ok: allOk, recipient: to, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[test-billing-emails] error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
