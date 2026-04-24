// Billing email helper — sends transactional emails via Resend through the
// Lovable connector gateway. Used by payments-webhook and check-trial-reminders.

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';
const FROM_ADDRESS = 'SkyIQ <info@skyIQ.net>';

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

export async function sendBillingEmail({ to, type, data }: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!lovableKey || !resendKey) {
    console.error('[billing-email] missing keys', { lovableKey: !!lovableKey, resendKey: !!resendKey });
    return { ok: false, error: 'missing api keys' };
  }
  if (!to || !/.+@.+\..+/.test(to)) {
    return { ok: false, error: 'invalid recipient' };
  }

  const { subject, html } = build(type, data);
  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': resendKey,
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[billing-email] ${type} failed`, res.status, body);
      return { ok: false, error: `${res.status}: ${body}` };
    }
    console.log(`[billing-email] sent ${type} to ${to}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[billing-email] ${type} threw`, msg);
    return { ok: false, error: msg };
  }
}
