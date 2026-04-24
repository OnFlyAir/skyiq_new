import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { track } from '@/lib/analytics';

interface Props {
  cycle: 'four_weekly' | 'annual';
  onBypass?: () => void;
  onError?: (msg: string) => void;
}

export default function StripeEmbeddedCheckout({ cycle, onBypass, onError }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const loadSecret = useCallback(async () => {
    setLoading(true);
    setError(null);
    setClientSecret(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: {
          cycle,
          return_url: `${window.location.origin}/subscription`,
          environment: getStripeEnvironment(),
        },
      });
      if (fnError) throw new Error(fnError.message || 'Unable to start checkout');
      if (data?.bypassed) {
        onBypass?.();
        return;
      }
      if (!data?.clientSecret) throw new Error('Checkout session could not be created. Please try again.');
      setClientSecret(data.clientSecret as string);
    } catch (e: any) {
      const msg = e?.message || 'Something went wrong starting checkout.';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [cycle, onBypass, onError]);

  useEffect(() => {
    loadSecret();
  }, [loadSecret, attempt]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Preparing secure checkout…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">We couldn't load checkout</p>
            <p className="text-sm text-muted-foreground break-words">{error}</p>
          </div>
        </div>
        <Button onClick={() => setAttempt((a) => a + 1)} size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (!clientSecret) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card">
      <EmbeddedCheckoutProvider
        // Re-mount provider when secret changes (retry).
        key={clientSecret}
        stripe={getStripe()}
        options={{ clientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
