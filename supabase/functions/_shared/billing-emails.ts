// Billing email helper — sends transactional emails via Resend directly
// using the RESEND_API_KEY secret. Used by payments-webhook and check-trial-reminders.

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'SkyIQ <info@skyiq.net>';

export type BillingEmailType =
  | 'trial_started'
  | 'trial_ending'
  | 'payment_failed'
  | 'subscription_canceled'
  | 'plan_changed';

interface SendArgs {
  to: string;
  type: BillingEmailType;
  data?: Record<string, any>;
  userId?: string;
}

const baseStyle = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#ffffff; color:#1a1a1a; margin:0; padding:0; }
    .container { max-width:560px; margin:0 auto; padding:32px 24px; }
    .h1 { font-size:22px; font-weight:700; margin:0 0 16px; color:#0f172a; }
    .p { font-size:15px; line-height:1.6; color:#334155; margin:0 0 16px; }
    .btn { display:inline-block; background:#0f172a; color:#ffffff !important; text-decoration:none; padding:12px 22px; border-radius:8px; font-weight:600; font-size:14px; margin:8px 0 16px; }
    .meta { font-size:13px; color:#64748b; margin-top:24px; padding-top:16px; border-top:1px solid #e2e8f0; }
    .brand { font-size:12px; color:#94a3b8; margin-top:24px; }
  </style>`;

function wrap(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8">${baseStyle}</head><body><div class="container">${html}<p class="brand">— OnFly Air Billing</p></div></body></html>`;
}

function build(type: BillingEmailType, data: Record<string, any> = {}): { subject: string; html: string } {
  const appUrl = data.appUrl || 'https://skiiq2.lovable.app';
  const subscriptionUrl = `${appUrl}/subscription`;
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  switch (type) {
    case 'trial_started':
      return {
        subject: 'Welcome to OnFly Air — your 30-day trial is active',
        html: wrap(`
          <h1 class="h1">Your trial has started</h1>
          <p class="p">Welcome aboard${data.firstName ? `, ${data.firstName}` : ''}! Your 30-day trial of OnFly Air is now active for just $1.</p>
          <p class="p">During your trial you have full access to fuel optimization, trip planning, and itinerary parsing. After your trial ends on <strong>${data.trialEndsAt || 'day 30'}</strong>, you'll be billed based on your active aircraft count.</p>
          <a class="btn" href="${subscriptionUrl}">View your subscription</a>
        `),
      };
    case 'trial_ending':
      return {
        subject: 'Your OnFly Air trial ends in 3 days',
        html: wrap(`
          <h1 class="h1">Trial ending soon</h1>
          <p class="p">Heads up${data.firstName ? `, ${data.firstName}` : ''} — your OnFly Air trial ends on <strong>${data.trialEndsAt}</strong>.</p>
          <p class="p">To keep your access uninterrupted, make sure your payment method is up to date. You'll be charged ${data.amount ? fmt(data.amount) : 'based on your active aircraft count'} on your first billing cycle.</p>
          <a class="btn" href="${subscriptionUrl}">Manage subscription</a>
        `),
      };
    case 'payment_failed':
      return {
        subject: 'Action required: payment failed for OnFly Air',
        html: wrap(`
          <h1 class="h1">We couldn't process your payment</h1>
          <p class="p">Your most recent OnFly Air payment of ${data.amount ? fmt(data.amount) : 'your subscription charge'} did not go through. Your account access has been paused.</p>
          <p class="p">To restore access, please update your payment method as soon as possible.</p>
          <a class="btn" href="${subscriptionUrl}">Update payment method</a>
          <p class="meta">If you've already updated your payment method, you can ignore this email — access restores automatically once payment succeeds.</p>
        `),
      };
    case 'subscription_canceled':
      return {
        subject: 'Your OnFly Air subscription has been canceled',
        html: wrap(`
          <h1 class="h1">Subscription canceled</h1>
          <p class="p">Your OnFly Air subscription has been canceled and your account access has been disabled.</p>
          <p class="p">If this was unintentional or you'd like to come back, you can reactivate at any time.</p>
          <a class="btn" href="${subscriptionUrl}">Reactivate subscription</a>
        `),
      };
    case 'plan_changed':
      return {
        subject: 'Your OnFly Air plan has been updated',
        html: wrap(`
          <h1 class="h1">Plan updated</h1>
          <p class="p">Your OnFly Air subscription has been updated. Here's a summary:</p>
          <p class="p">
            <strong>Aircraft:</strong> ${data.aircraftCount ?? '—'}<br>
            <strong>Billing cycle:</strong> ${data.billingCycle === 'annual' ? 'Annual (20% off)' : '4-week'}<br>
            <strong>Next charge:</strong> ${data.amount ? fmt(data.amount) : '—'}
          </p>
          <p class="p">Changes take effect at your next renewal on <strong>${data.nextRenewal || 'your next billing date'}</strong>.</p>
          <a class="btn" href="${subscriptionUrl}">View subscription</a>
        `),
      };
  }
}

async function logAttempt(args: {
  userId?: string;
  to: string;
  type: BillingEmailType;
  status: 'sent' | 'failed';
  error?: string;
  providerResponse?: string;
}) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return;
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
    const supabase = createClient(supabaseUrl, serviceKey);
    await supabase.from('billing_email_log').insert({
      user_id: args.userId ?? null,
      recipient_email: args.to,
      email_type: args.type,
      status: args.status,
      error_message: args.error ?? null,
      provider_response: args.providerResponse ?? null,
    } as any);
  } catch (e) {
    console.error('[billing-email] log insert failed', e);
  }
}

// Maps each email type to which preference categories it belongs to.
// 'all' always receives everything; 'none' never receives anything.
const TYPE_CATEGORY: Record<BillingEmailType, 'critical' | 'changes' | 'lifecycle'> = {
  trial_started: 'lifecycle',
  trial_ending: 'lifecycle',
  payment_failed: 'critical',
  subscription_canceled: 'critical',
  plan_changed: 'changes',
};

async function getUserPreference(userId?: string): Promise<'all' | 'critical' | 'changes' | 'none'> {
  if (!userId) return 'all';
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return 'all';
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data } = await supabase
      .from('profiles')
      .select('billing_email_preference')
      .eq('id', userId)
      .maybeSingle();
    return ((data as any)?.billing_email_preference as any) || 'all';
  } catch {
    return 'all';
  }
}

function shouldSend(type: BillingEmailType, pref: 'all' | 'critical' | 'changes' | 'none'): boolean {
  if (pref === 'all') return true;
  if (pref === 'none') return false;
  const category = TYPE_CATEGORY[type];
  // Critical emails always go through unless user picked 'none' or 'changes'
  if (pref === 'critical') return category === 'critical';
  if (pref === 'changes') return category === 'changes' || category === 'critical';
  return true;
}

export async function sendBillingEmail({ to, type, data, userId }: SendArgs): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    const error = 'missing RESEND_API_KEY';
    console.error('[billing-email]', error);
    await logAttempt({ userId, to, type, status: 'failed', error });
    return { ok: false, error };
  }
  if (!to || !/.+@.+\..+/.test(to)) {
    const error = 'invalid recipient email';
    await logAttempt({ userId, to: to || '(empty)', type, status: 'failed', error });
    return { ok: false, error };
  }

  // Respect user preference (skipped if no userId — e.g. system tests)
  const pref = await getUserPreference(userId);
  if (!shouldSend(type, pref)) {
    console.log(`[billing-email] skipped ${type} for user ${userId} (preference=${pref})`);
    return { ok: true, skipped: true };
  }

  const { subject, html } = build(type, data);
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[billing-email] ${type} failed`, res.status, body);
      await logAttempt({
        userId, to, type, status: 'failed',
        error: `Resend ${res.status}`,
        providerResponse: body.slice(0, 2000),
      });
      return { ok: false, error: `${res.status}: ${body}` };
    }
    console.log(`[billing-email] sent ${type} to ${to}`);
    await logAttempt({ userId, to, type, status: 'sent', providerResponse: body.slice(0, 500) });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[billing-email] ${type} threw`, msg);
    await logAttempt({ userId, to, type, status: 'failed', error: msg });
    return { ok: false, error: msg };
  }
}

