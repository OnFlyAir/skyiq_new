// Self-serve subscription cancellation with a two-step, code-verified flow.
//
// Actions:
//   start        -> records the request + reason, returns the retention offer
//   accept_offer -> applies a 20% retention discount in Stripe, keeps the plan
//   send_code    -> emails a 6-digit verification code to the account email
//   confirm      -> verifies the code, cancels at period end in Stripe

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { stripeFetch, form, type StripeEnv } from '../_shared/stripe-gateway.ts';
import { sendBillingEmail } from '../_shared/billing-emails.ts';

const RETENTION_COUPON_ID = 'skyiq_retention_20';
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(value: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function ensureCoupon(env: StripeEnv) {
  try {
    return await stripeFetch(`/v1/coupons/${RETENTION_COUPON_ID}`, { method: 'GET' }, env);
  } catch {
    return await stripeFetch('/v1/coupons', {
      method: 'POST',
      body: form({
        id: RETENTION_COUPON_ID,
        percent_off: 20,
        duration: 'once',
        name: 'SkyIQ loyalty discount (20% off one month)',
      }),
    }, env);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    ) as any;

    const body = await req.json().catch(() => ({} as any));
    const action: string = body.action;
    const env: StripeEnv = body.environment === 'live' ? 'live' : 'sandbox';

    const { data: profile } = await admin
      .from('profiles').select('id, email, first_name').eq('id', user.id).maybeSingle();
    const { data: sub } = await admin
      .from('subscriptions').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!sub) return json({ error: 'No subscription found' }, 404);

    // ---- start -------------------------------------------------------
    if (action === 'start') {
      const reason = typeof body.reason === 'string' ? body.reason.slice(0, 1000) : '';
      const { data: created, error } = await admin.from('cancellation_requests').insert({
        user_id: user.id,
        subscription_id: sub.id,
        reason,
        status: 'pending',
        offer_shown: true,
      }).select('id').single();
      if (error) throw new Error(error.message);
      return json({
        request_id: created.id,
        offer: {
          percent_off: 20,
          already_discounted: !!sub.retention_discount_percent,
        },
      });
    }

    const requestId: string | undefined = body.request_id;
    if (!requestId) return json({ error: 'Missing request_id' }, 400);
    const { data: request } = await admin
      .from('cancellation_requests').select('*').eq('id', requestId).maybeSingle();
    if (!request || request.user_id !== user.id) return json({ error: 'Request not found' }, 404);
    if (request.status !== 'pending') return json({ error: 'This request is already closed' }, 400);

    // ---- accept_offer -------------------------------------------------
    if (action === 'accept_offer') {
      if (sub.retention_discount_percent) {
        return json({ error: 'A loyalty discount is already active on this plan' }, 400);
      }
      if (sub.stripe_subscription_id) {
        await ensureCoupon(env);
        await stripeFetch(`/v1/subscriptions/${sub.stripe_subscription_id}`, {
          method: 'POST',
          body: form({ 'discounts[0][coupon]': RETENTION_COUPON_ID }),
        }, env);
      }
      await admin.from('subscriptions').update({
        retention_discount_percent: 20,
        retention_discount_applied_at: new Date().toISOString(),
      }).eq('id', sub.id);
      await admin.from('cancellation_requests').update({
        status: 'retained', offer_accepted: true,
      }).eq('id', requestId);
      return json({ ok: true, retained: true });
    }

    // ---- send_code -----------------------------------------------------
    if (action === 'send_code') {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await admin.from('cancellation_requests').update({
        code_hash: await sha256(code),
        code_expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        attempts: 0,
      }).eq('id', requestId);

      const result = await sendBillingEmail({
        to: profile?.email ?? user.email ?? '',
        type: 'cancel_code',
        userId: user.id,
        data: { firstName: profile?.first_name, code },
      });
      if (!result.ok) return json({ error: 'Could not send the verification code' }, 500);
      return json({ ok: true, sent_to: profile?.email ?? user.email });
    }

    // ---- confirm --------------------------------------------------------
    if (action === 'confirm') {
      const code = String(body.code ?? '').trim();
      if (!/^\d{6}$/.test(code)) return json({ error: 'Enter the 6-digit code' }, 400);
      if (!request.code_hash || !request.code_expires_at) {
        return json({ error: 'Request a code first' }, 400);
      }
      if (new Date(request.code_expires_at).getTime() < Date.now()) {
        return json({ error: 'That code expired — send a new one' }, 400);
      }
      if (request.attempts >= MAX_ATTEMPTS) {
        await admin.from('cancellation_requests').update({ status: 'locked' }).eq('id', requestId);
        return json({ error: 'Too many attempts. Start over.' }, 429);
      }
      if (await sha256(code) !== request.code_hash) {
        await admin.from('cancellation_requests')
          .update({ attempts: request.attempts + 1 }).eq('id', requestId);
        return json({ error: 'That code is not correct' }, 400);
      }

      if (sub.stripe_subscription_id) {
        await stripeFetch(`/v1/subscriptions/${sub.stripe_subscription_id}`, {
          method: 'POST',
          body: form({ cancel_at_period_end: 'true' }),
        }, env);
      }
      const now = new Date().toISOString();
      await admin.from('subscriptions').update({
        status: 'canceled', canceled_at: now,
      }).eq('id', sub.id);
      await admin.from('cancellation_requests').update({
        status: 'canceled', confirmed_at: now, code_hash: null,
      }).eq('id', requestId);

      const accessUntil = sub.current_period_end ?? sub.trial_ends_at ?? null;
      await sendBillingEmail({
        to: profile?.email ?? user.email ?? '',
        type: 'subscription_canceled',
        userId: user.id,
        data: {
          firstName: profile?.first_name,
          accessUntil: accessUntil
            ? new Date(accessUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : null,
        },
      });

      return json({ ok: true, canceled: true, access_until: accessUntil });
    }

    return json({ error: 'Invalid action' }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown';
    console.error('cancel-subscription error:', message);
    return json({ error: message }, 500);
  }
});
