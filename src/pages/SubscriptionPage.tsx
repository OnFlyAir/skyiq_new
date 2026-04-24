import { useState, useEffect } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Plane, Calendar, AlertCircle, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { formatCurrency, formatCurrencyCents } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

interface Subscription {
  id: string;
  status: string;
  billing_cycle: string;
  pending_billing_cycle: string | null;
  trial_starts_at: string;
  trial_ends_at: string;
  current_period_start: string | null;
  current_period_end: string | null;
  aircraft_count: number;
  monthly_amount_cents: number;
  canceled_at: string | null;
}

const PRICING_TIERS = [
  { range: '1–4 aircraft', perPlane: 200 },
  { range: '5–9 aircraft', perPlane: 150 },
  { range: '10+ aircraft', perPlane: 100 },
];

function calcPrice(count: number): number {
  if (count <= 0) return 0;
  let total = 0;
  total += Math.min(count, 4) * 200;
  if (count > 4) total += Math.min(count - 4, 5) * 150;
  if (count > 9) total += (count - 9) * 100;
  return total;
}

function statusColor(status: string) {
  switch (status) {
    case 'trial': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'active': return 'bg-green-100 text-green-800 border-green-200';
    case 'past_due': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-muted text-muted-foreground';
  }
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SubscriptionPage() {
  const { profile } = useAuthContext();
  const { toast } = useToast();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [aircraftCount, setAircraftCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const canManageBilling = profile?.role_name === 'Admin'
    || profile?.role_name === 'Dev'
    || !!profile?.is_billing_manager;

  const isExempt = profile?.role_name === 'Admin' || profile?.role_name === 'Dev';

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const [subRes, acRes] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('user_id', profile!.id).maybeSingle(),
        supabase.from('aircrafts').select('id').eq('user_company', profile!.id).eq('is_enabled', true),
      ]);
      setSub(subRes.data as unknown as Subscription);
      setAircraftCount(acRes.data?.length ?? 0);
      setLoading(false);
    }
    load();
  }, [profile]);

  async function startCheckout(cycle: 'four_weekly' | 'annual') {
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { cycle, return_url: `${window.location.origin}/subscription` },
      });
      if (error) throw error;
      if (data?.bypassed) {
        toast({ title: 'Account activated', description: 'No billing required for your role.' });
        window.location.reload();
        return;
      }
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Checkout failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setActing(false);
    }
  }

  async function schedulCycleSwitch(target: 'four_weekly' | 'annual') {
    if (!sub) return;
    setActing(true);
    const { error } = await supabase
      .from('subscriptions')
      .update({ pending_billing_cycle: target } as any)
      .eq('id', sub.id);
    setActing(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSub({ ...sub, pending_billing_cycle: target });
      toast({
        title: 'Change scheduled',
        description: `Switching to ${target === 'annual' ? 'annual' : '4-week'} billing at next renewal.`,
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ============================================================
  // VIEW 1 — Non-billing user (pilot etc.) sees a read-only card
  // ============================================================
  if (!canManageBilling) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/50 border">
              <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Billing is managed by your account administrator</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Plan changes, payment methods, and invoices are handled at the company level.
                  Reach out to your admin if you need an adjustment.
                </p>
              </div>
            </div>
            {sub && (
              <div className="grid grid-cols-2 gap-3 text-sm pt-2">
                <div>
                  <p className="text-muted-foreground">Plan status</p>
                  <p className="font-medium capitalize">{sub.status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Billing cycle</p>
                  <p className="font-medium">{sub.billing_cycle === 'annual' ? 'Annual' : 'Every 4 weeks'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // VIEW 2 — Billing-eligible user (Admin / Dev / Billing Manager)
  // ============================================================
  const daysLeft = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;

  const monthlyPrice = calcPrice(aircraftCount);
  const fourWeekPrice = monthlyPrice;
  const annualPrice = Math.round(monthlyPrice * 13 * 0.8);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Subscription</h1>

      {isExempt && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-green-900">
            Your <span className="font-semibold">{profile?.role_name}</span> account is billing-exempt — no charges will apply.
          </span>
        </div>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Current Plan</CardTitle>
            {sub && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColor(sub.status)}`}>
                {sub.status === 'trial' ? `Trial — ${daysLeft} days left` : sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!sub ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">No subscription yet</p>
                <p className="text-sm text-amber-700 mt-1">
                  {isExempt
                    ? 'Click below to activate your account.'
                    : 'Start your $1 trial to unlock all features for 30 days.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Stat icon={<Plane className="h-5 w-5 text-muted-foreground" />} label="Aircraft" value={aircraftCount} />
              <Stat
                icon={<CreditCard className="h-5 w-5 text-muted-foreground" />}
                label="Billing Cycle"
                value={sub.billing_cycle === 'annual' ? 'Annual (20% off)' : 'Every 4 weeks'}
              />
              <Stat
                icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
                label={sub.status === 'trial' ? 'Trial Ends' : 'Next Billing'}
                value={formatDate(sub.status === 'trial' ? sub.trial_ends_at : sub.current_period_end)}
              />
              <Stat
                icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
                label="Amount"
                value={sub.status === 'trial' ? `${formatCurrency(1)} trial` : formatCurrencyCents(sub.monthly_amount_cents)}
              />
            </div>
          )}

          {sub?.pending_billing_cycle && sub.pending_billing_cycle !== sub.billing_cycle && (
            <div className="text-xs p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-900">
              <span className="font-medium">Scheduled change:</span> switching to{' '}
              {sub.pending_billing_cycle === 'annual' ? 'annual (20% off)' : 'every 4 weeks'} on {formatDate(sub.current_period_end)}.
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {!sub && !isExempt && (
              <>
                <Button onClick={() => startCheckout('four_weekly')} disabled={acting} className="flex-1 min-w-[180px]">
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start $1 Trial · 4-week billing'}
                </Button>
                <Button onClick={() => startCheckout('annual')} disabled={acting} variant="outline" className="flex-1 min-w-[180px]">
                  Start $1 Trial · Annual (20% off)
                </Button>
              </>
            )}
            {!sub && isExempt && (
              <Button onClick={() => startCheckout('four_weekly')} disabled={acting} className="flex-1">
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate account'}
              </Button>
            )}
            {sub && !isExempt && (sub.status === 'trial' || sub.status === 'active') && (
              <>
                {sub.billing_cycle === 'four_weekly' && sub.pending_billing_cycle !== 'annual' && (
                  <Button onClick={() => schedulCycleSwitch('annual')} disabled={acting} variant="outline">
                    Switch to annual (save 20%)
                  </Button>
                )}
                {sub.billing_cycle === 'annual' && sub.pending_billing_cycle !== 'four_weekly' && (
                  <Button onClick={() => schedulCycleSwitch('four_weekly')} disabled={acting} variant="outline">
                    Switch to 4-week billing
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Pricing</CardTitle>
          <p className="text-xs text-muted-foreground">Aircraft count auto-adjusts at your next billing cycle.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {PRICING_TIERS.map((tier) => (
              <div key={tier.range} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-foreground">{tier.range}</span>
                <span className="text-sm font-semibold">{formatCurrency(tier.perPlane)}/plane per cycle</span>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-secondary/50 rounded-lg space-y-2">
            <p className="text-sm font-medium text-foreground">Your estimate ({aircraftCount} aircraft):</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Every 4 weeks</span>
              <span className="font-semibold">{formatCurrency(fourWeekPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Annual (20% off)</span>
              <span className="font-semibold text-green-600">{formatCurrency(annualPrice)}/yr</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function DollarSign(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
