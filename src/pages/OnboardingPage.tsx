import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Check,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import StripeEmbeddedCheckout from '@/components/StripeEmbeddedCheckout';
import { useToast } from '@/hooks/use-toast';
import { track } from '@/lib/analytics';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

const TOTAL_STEPS = 2;

export default function OnboardingPage() {
  const { profile, user } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [cycle, setCycle] = useState<'four_weekly' | 'annual'>('four_weekly');
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    track('onboarding_step_viewed', { step, total_steps: TOTAL_STEPS });
  }, [step]);

  const isExempt = profile?.role_name === 'Admin' || profile?.role_name === 'Dev';

  // DFY signup carry-over from sign-up form
  useEffect(() => {
    if (!user) return;
    const dfyData = localStorage.getItem('skyiq_dfy_signup');
    if (!dfyData) return;
    (async () => {
      try {
        const parsed = JSON.parse(dfyData);
        const { data: existing } = await supabase
          .from('dfy_clients' as any)
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from('dfy_clients' as any).insert({
            user_id: user.id,
            company_name: parsed.company_name || '',
            contact_name: parsed.contact_name || '',
            contact_email: parsed.contact_email || '',
            pricing_tier: 'per_trip',
          } as any);
        }
        localStorage.removeItem('skyiq_dfy_signup');
      } catch (err) {
        console.error('DFY client setup error:', err);
      }
    })();
  }, [user]);

  async function handleExemptActivate() {
    setActivating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { cycle, return_url: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      if (data?.bypassed) {
        toast({ title: 'Account activated', description: 'Your role is billing-exempt.' });
        navigate('/dashboard');
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setActivating(false);
    }
  }

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <img src={skyiqLogo} alt="SkyIQ" className="w-14 h-14 object-contain mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Activate your account</h1>
          <p className="text-sm text-muted-foreground">
            Start your 4-week trial for $1.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i + 1 === step
                  ? 'w-10 bg-primary'
                  : i + 1 < step
                    ? 'w-6 bg-primary/60'
                    : 'w-6 bg-muted'
              }`}
            />
          ))}
          <span className="ml-3 text-xs text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>

        <Card className="border-primary/30">
          <CardContent className="p-6 space-y-5">
            {/* STEP 1 — $1 trial */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">4 weeks of SkyIQ for $1</h2>
                    <p className="text-xs text-muted-foreground">28 days · cancel anytime</p>
                  </div>
                </div>
                <p className="text-sm text-foreground/90">
                  Pay just <strong>$1 today</strong> and get <strong>4 full weeks</strong> of
                  SkyIQ — every feature unlocked. You'll set your fleet size and choose a
                  billing plan inside the app whenever you're ready.
                </p>
                <ul className="space-y-1.5 text-sm">
                  {[
                    '$1 charged today',
                    '4 full weeks of access — every feature unlocked',
                    'Cancel before week 4 and pay nothing more',
                  ].map((it) => (
                    <li key={it} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-foreground">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* STEP 2 — Payment */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {isExempt ? 'Activate your account' : 'Add your payment details'}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {isExempt
                        ? `Your ${profile?.role_name} role is billing-exempt — no payment required.`
                        : '$1 for your initial 4-week trial · cancel anytime'}
                    </p>
                  </div>
                </div>

                {!isExempt && (
                  <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">
                      How billing works
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                      <li>
                        <span className="text-foreground font-medium">$1 today</span> for your initial trial period of 4 weeks.
                      </li>
                      <li>
                        After the trial, <span className="text-foreground font-medium">$100–$200 per tail/month</span> based on the number of aircraft in your fleet.
                      </li>
                      <li>
                        You'll choose 4-weekly or annual billing (save 20%) inside the app — nothing more is charged today.
                      </li>
                      <li>Cancel anytime before the trial ends and you won't be charged again.</li>
                    </ul>
                  </div>
                )}

                {isExempt ? (
                  <Button
                    onClick={handleExemptActivate}
                    disabled={activating}
                    size="lg"
                    className="w-full"
                  >
                    {activating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Activate account'
                    )}
                  </Button>
                ) : (
                  <StripeEmbeddedCheckout
                    cycle={cycle}
                    returnUrl={`${window.location.origin}/dashboard?checkout=success`}
                    onBypass={() => navigate('/dashboard')}
                    onError={(msg) =>
                      toast({
                        title: 'Checkout error',
                        description: msg,
                        variant: 'destructive',
                      })
                    }
                  />
                )}
              </div>
            )}

            {/* Footer nav (hide forward button on last step — Stripe checkout handles completion) */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={prev}
                disabled={step === 1}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              {step < TOTAL_STEPS && (
                <Button onClick={next} size="sm" className="gap-1">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
