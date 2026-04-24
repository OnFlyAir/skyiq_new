import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plane,
  Check,
  Sparkles,
  Loader2,
  Minus,
  Plus,
  Wrench,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  TrendingDown,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import StripeEmbeddedCheckout from '@/components/StripeEmbeddedCheckout';
import { useToast } from '@/hooks/use-toast';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

// Tiered per-plane pricing (mirrors public.calculate_subscription_price).
const PRICING_TIERS = [
  { range: '1–4 aircraft', min: 1, max: 4, perPlane: 200, note: 'Starter' },
  { range: '5–9 aircraft', min: 5, max: 9, perPlane: 150, note: 'Growing fleet' },
  { range: '10+ aircraft', min: 10, max: Infinity, perPlane: 100, note: 'Enterprise' },
];

const ANNUAL_DISCOUNT = 0.2;

function calc4WeeklyTotal(count: number): number {
  if (count <= 0) return 0;
  let total = 0;
  total += Math.min(count, 4) * 200;
  if (count > 4) total += Math.min(count - 4, 5) * 150;
  if (count > 9) total += (count - 9) * 100;
  return total;
}

function activeTierIndex(count: number): number {
  if (count <= 4) return 0;
  if (count <= 9) return 1;
  return 2;
}

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const { profile, user } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [planeCount, setPlaneCount] = useState<number>(3);
  const [cycle, setCycle] = useState<'four_weekly' | 'annual'>('four_weekly');
  const [activating, setActivating] = useState(false);

  const fourWeeklyTotal = useMemo(() => calc4WeeklyTotal(planeCount), [planeCount]);
  const annualTotal = useMemo(
    () => Math.round(fourWeeklyTotal * 13 * (1 - ANNUAL_DISCOUNT)),
    [fourWeeklyTotal],
  );
  const currentTierIdx = activeTierIndex(planeCount);

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
            Four quick steps to start flying smarter.
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
                  SkyIQ — every feature unlocked. Your regular subscription only kicks in
                  after the 4 weeks end. Cancel any time before and pay nothing more.
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

            {/* STEP 2 — Billing & estimate */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">How billing works</h2>
                    <p className="text-xs text-muted-foreground">
                      Per-aircraft · billed every 4 weeks
                    </p>
                  </div>
                </div>
                <p className="text-sm text-foreground/90">
                  After your trial, you only pay for active aircraft. The more planes in your
                  fleet, the lower the per-plane rate. Enable or disable planes anytime — your
                  invoice adjusts automatically.
                </p>

                {/* Tier list */}
                <div className="space-y-2">
                  {PRICING_TIERS.map((tier, idx) => {
                    const isActive = idx === currentTierIdx;
                    return (
                      <div
                        key={tier.range}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isActive
                            ? 'bg-primary/10 border-primary/40'
                            : 'bg-secondary/40 border-border'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Plane
                            className={`h-4 w-4 ${
                              isActive ? 'text-primary' : 'text-muted-foreground'
                            }`}
                          />
                          <div>
                            <p className="text-sm font-medium text-foreground">{tier.range}</p>
                            <p className="text-xs text-muted-foreground">{tier.note}</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(tier.perPlane)}/plane
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Estimate */}
                <div className="rounded-lg border border-border p-4 space-y-3 bg-secondary/30">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Plane className="h-4 w-4 text-primary" />
                      Estimate your fleet size
                    </label>
                    <span className="text-sm font-semibold text-foreground">
                      {planeCount} {planeCount === 1 ? 'plane' : 'planes'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setPlaneCount((n) => Math.max(1, n - 1))}
                      disabled={planeCount <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <input
                      type="range"
                      min={1}
                      max={25}
                      value={Math.min(planeCount, 25)}
                      onChange={(e) => setPlaneCount(Number(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setPlaneCount((n) => n + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-baseline justify-between pt-2 border-t border-border">
                    <span className="text-sm text-muted-foreground">Every 4 weeks</span>
                    <span className="text-2xl font-bold text-foreground">
                      {formatCurrency(fourWeeklyTotal)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">Annual (save 20%)</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(annualTotal)}/yr
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Nothing else is charged today beyond the $1 for your 4-week trial.
                </p>
              </div>
            )}

            {/* STEP 3 — DFY */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      Optional: Done-For-You planning
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      $25 per plan · billed end of month · only when used
                    </p>
                  </div>
                </div>
                <p className="text-sm text-foreground/90">
                  Don't have time to build fuel plans yourself? Upload a trip itinerary and our
                  team delivers a fully optimized plan to your inbox — usually within hours.
                </p>
                <ul className="space-y-1.5 text-sm">
                  {[
                    'Upload any trip itinerary (PDF or document)',
                    'Our team builds the optimized fuel plan',
                    'Delivered ready-to-file, usually within hours',
                    'No upfront charge — $25 per plan added to your end-of-month invoice',
                  ].map((it) => (
                    <li key={it} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-foreground">{it}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  You can request DFY plans anytime from the DFY tab inside the app — no need to
                  decide now.
                </p>
              </div>
            )}

            {/* STEP 4 — Payment */}
            {step === 4 && (
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
                        : '$1 charged today · 30 days free · cancel anytime'}
                    </p>
                  </div>
                </div>

                {!isExempt && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCycle('four_weekly')}
                      className={`flex-1 p-3 rounded-lg border text-left text-sm transition-all ${
                        cycle === 'four_weekly'
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-secondary/30 hover:border-primary/50'
                      }`}
                    >
                      <div className="font-semibold text-foreground">4-week billing</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Pay-as-you-go flexibility
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCycle('annual')}
                      className={`flex-1 p-3 rounded-lg border text-left text-sm transition-all ${
                        cycle === 'annual'
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-secondary/30 hover:border-primary/50'
                      }`}
                    >
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        Annual
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Save 20%
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Best value</div>
                    </button>
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

            {/* Footer nav (hide forward button on step 4 — Stripe checkout handles completion) */}
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
