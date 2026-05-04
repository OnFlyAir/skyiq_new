// Shared helpers for talking to Stripe through the Lovable connector gateway.
// We intentionally do NOT use the Stripe SDK — the API keys are gateway
// connection tokens, not real Stripe secret keys.

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/stripe';

export type StripeEnv = 'sandbox' | 'live';

export function getStripeKey(env: StripeEnv = 'sandbox'): string {
  const key = env === 'live'
    ? Deno.env.get('STRIPE_LIVE_API_KEY')
    : Deno.env.get('STRIPE_SANDBOX_API_KEY');
  if (!key) throw new Error(`Missing STRIPE_${env.toUpperCase()}_API_KEY`);
  return key;
}

export function getWebhookSecret(env: StripeEnv = 'sandbox'): string | null {
  return env === 'live'
    ? Deno.env.get('PAYMENTS_LIVE_WEBHOOK_SECRET') ?? null
    : Deno.env.get('PAYMENTS_SANDBOX_WEBHOOK_SECRET') ?? null;
}

export function form(obj: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    p.append(k, String(v));
  }
  return p.toString();
}

export async function stripeFetch(
  path: string,
  init: RequestInit = {},
  env: StripeEnv = 'sandbox',
): Promise<any> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) throw new Error('LOVABLE_API_KEY missing');
  const stripeKey = getStripeKey(env);

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': stripeKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

// HMAC-SHA256 verification of a Stripe webhook signature header.
// Returns the parsed event, or throws if the signature is invalid.
export async function verifyAndParseWebhook(
  req: Request,
  env: StripeEnv = 'sandbox',
): Promise<{ event: any; rawBody: string }> {
  const secret = getWebhookSecret(env);
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('stripe-signature');

  // If no secret configured, log and accept (dev-only fallback) — but warn loudly.
  if (!secret) {
    console.warn(`[webhook] no ${env} webhook secret configured — accepting without verification`);
    return { event: JSON.parse(rawBody), rawBody };
  }
  if (!signatureHeader) throw new Error('missing stripe-signature header');

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.split('=', 2);
    if (k === 't') timestamp = v;
    if (k === 'v1') v1Signatures.push(v);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error('invalid signature format');

  // Reject events older than 5 minutes to prevent replay.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error('webhook timestamp too old');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (!v1Signatures.includes(expected)) throw new Error('invalid webhook signature');

  return { event: JSON.parse(rawBody), rawBody };
}

// Compute our tiered price (cents per cycle) server-side.
// Mirrors SubscriptionPage.calcPrice and create-checkout.calcPriceCents.
//
// IMPORTANT: callers MUST pass a real aircraft count for recurring
// subscriptions. We default count<=0 to a 1-aircraft Starter tier so a
// caller bug can never accidentally bill someone $1/year — but the
// create-checkout function blocks recurring checkouts with 0 aircraft
// outright so users see a clear "add aircraft first" message instead.
export function calcPriceCents(count: number, cycle: 'four_weekly' | 'annual'): number {
  const safeCount = count > 0 ? count : 1;
  let perCycle = 0;
  perCycle += Math.min(safeCount, 4) * 20000;
  if (safeCount > 4) perCycle += Math.min(safeCount - 4, 5) * 15000;
  if (safeCount > 9) perCycle += (safeCount - 9) * 10000;
  return cycle === 'annual' ? Math.round(perCycle * 13 * 0.8) : perCycle;
}
