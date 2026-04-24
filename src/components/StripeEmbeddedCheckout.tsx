import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

interface Props {
  cycle: 'four_weekly' | 'annual';
  onBypass?: () => void;
  onError?: (msg: string) => void;
}

export default function StripeEmbeddedCheckout({ cycle, onBypass, onError }: Props) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        cycle,
        return_url: `${window.location.origin}/subscription`,
        environment: getStripeEnvironment(),
      },
    });
    if (error) throw new Error(error.message || 'Checkout failed');
    if (data?.bypassed) {
      onBypass?.();
      // Return a dummy secret to satisfy the provider; bypass flow navigates away.
      return '';
    }
    if (!data?.clientSecret) throw new Error('No client secret returned');
    return data.clientSecret as string;
  }, [cycle, onBypass]);

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card">
      <EmbeddedCheckoutProvider
        stripe={getStripe()}
        options={{ fetchClientSecret: () => fetchClientSecret().catch((e) => {
          onError?.(e.message);
          return '';
        }) }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
