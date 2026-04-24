import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plane, Check, TrendingDown, Sparkles, Loader2, Minus, Plus, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import StripeEmbeddedCheckout from '@/components/StripeEmbeddedCheckout';
import { useToast } from '@/hooks/use-toast';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

// Tiered per-plane pricing (mirrors public.calculate_subscription_price).
// Billed every 4 weeks. Tiers apply marginally — first 4 at $200,
// next 5 at $150, everything above 9 at $100.
const PRICING_TIERS = [
  { range: '1–4 aircraft', min: 1, max: 4, perPlane: 200, note: 'Starter' },
  { range: '5–9 aircraft', min: 5, max: 9, perPlane: 150, note: 'Growing fleet' },
  { range: '10+ aircraft', min: 10, max: Infinity, perPlane: 100, note: 'Enterprise' },
];

const DFY_RATE = 25;
const ANNUAL_DISCOUNT = 0.2; // 20%

function calc4WeeklyTotal(count: number): number {
  if (count <= 0) return 0;
  let total = 0;
  const first = Math.min(count, 4);
  total += first * 200;
  if (count > 4) {
    const second = Math.min(count - 4, 5);
    total += second * 150;
  }
  if (count > 9) {
    total += (count - 9) * 100;
  }
  return total;
}

function effectivePerPlane(count: number): number {
  if (count <= 0) return 0;
  return calc4WeeklyTotal(count) / count;
}

function activeTierIndex(count: number): number {
  if (count <= 4) return 0;
  if (count <= 9) return 1;
  return 2;
}

export default function OnboardingPage() {
  const { profile, user } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checkoutCycle, setCheckoutCycle] = useState<'four_weekly' | 'annual' | null>(null);
  const [activating, setActivating] = useState(false);

  // Interactive calculator — preview the real-time monthly cost.
  const [planeCount, setPlaneCount] = useState<number>(3);
  const [dfyPlans, setDfyPlans] = useState<number>(0);

  const fourWeeklyTotal = useMemo(() => calc4WeeklyTotal(planeCount), [planeCount]);
  const annualTotal = useMemo(
    () => Math.round(fourWeeklyTotal * 13 * (1 - ANNUAL_DISCOUNT)),
    [fourWeeklyTotal],
  );
  const perPlane = useMemo(() => effectivePerPlane(planeCount), [planeCount]);
  const currentTierIdx = activeTierIndex(planeCount);
  const dfyMonthlyAddon = dfyPlans * DFY_RATE;

  const isExempt = profile?.role_name === 'Admin' || profile?.role_name === 'Dev';

  // Create DFY client record if user signed up with DFY option
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

  async function startTrial(cycle: 'four_weekly' | 'annual') {
    if (isExempt) {
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
      return;
    }
    setCheckoutCycle(cycle);
  }

  // Checkout overlay
  if (checkoutCycle) {
    return (
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Start your $1 trial</h1>
            <Button variant="ghost" onClick={() => setCheckoutCycle(null)}>Back</Button>
          </div>
          <p className="text-sm text-muted-foreground">
            You'll be charged <strong>$1 today</strong> to verify your card. Your 30-day free
            trial starts now — you won't be billed the full subscription until it ends.
          </p>
          <StripeEmbeddedCheckout
            cycle={checkoutCycle}
            onBypass={() => navigate('/dashboard')}
            onError={(msg) => {
              toast({ title: 'Checkout error', description: msg, variant: 'destructive' });
              setCheckoutCycle(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <img src={skyiqLogo} alt="SkyIQ" className="w-16 h-16 object-contain mx-auto" />
          <h1 className="text-3xl font-bold text-foreground">
            Welcome{profile?.first_name ? `, ${profile.first_name}` : ''} 👋
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            To activate your account, please start your <strong>$1 trial</strong>. Your card is
            verified with a one-time $1 charge, and you get <strong>30 days free</strong> before
            your subscription begins.
          </p>
        </div>

        {/* How pricing works */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingDown className="h-5 w-5 text-primary" />
              How you'll be priced
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Billing scales with your <strong>active aircraft</strong>. Enable or disable planes
              in your fleet anytime — your invoice adjusts automatically.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {PRICING_TIERS.map((tier) => (
                <div
                  key={tier.range}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <Plane className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{tier.range}</p>
                      <p className="text-xs text-muted-foreground">{tier.note}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(tier.perPlane)}/plane · every 4 weeks
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-foreground">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p>
                  <strong>Dynamic pricing:</strong> your price tier updates automatically as you
                  add or remove active aircraft. Switch to <strong>annual billing</strong> and
                  save <strong>20%</strong> — available anytime from your subscription page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DFY Service */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Done-For-You Fuel Planning
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-auto">
                $25 per fuel plan
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Don't want to build fuel plans yourself? Upload your trip sheets and our team will
              optimize your fuel plan for you — <strong>$25 per fuel plan</strong>, billed only
              when you use it.
            </p>
            <ul className="space-y-1.5 pl-1">
              {[
                'Upload any trip itinerary (PDF or document)',
                'Our team builds a fully optimized fuel plan',
                'Delivered to your inbox — ready to file',
                'No commitment — pay only per plan used',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs pt-2">
              You can request a DFY plan anytime from the DFY tab once your account is active.
            </p>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">
                {isExempt ? 'Activate your account' : 'Start your $1 trial today'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isExempt
                  ? `Your ${profile?.role_name} role is billing-exempt — no payment required.`
                  : '$1 today · 30 days free · cancel anytime'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => startTrial('four_weekly')}
                disabled={activating}
                className="flex-1"
                size="lg"
              >
                {activating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isExempt ? (
                  'Activate account'
                ) : (
                  'Start $1 Trial · 4-week'
                )}
              </Button>
              {!isExempt && (
                <Button
                  onClick={() => startTrial('annual')}
                  disabled={activating}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  Start $1 Trial · Annual (save 20%)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
