// Stripe.js lazy loader. Uses VITE_PAYMENTS_CLIENT_TOKEN, which is set
// automatically by the Lovable payments integration. `pk_test_…` in preview,
// `pk_live_…` after publish.
import { loadStripe, type Stripe } from '@stripe/stripe-js';

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!clientToken) {
      throw new Error('VITE_PAYMENTS_CLIENT_TOKEN is not set');
    }
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export type StripeEnv = 'sandbox' | 'live';

export function getStripeEnvironment(): StripeEnv {
  return clientToken?.startsWith('pk_test_') ? 'sandbox' : 'live';
}

export function isTestMode(): boolean {
  return getStripeEnvironment() === 'sandbox';
}
