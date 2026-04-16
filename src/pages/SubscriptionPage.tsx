import { useState, useEffect } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Plane, Calendar, AlertCircle } from 'lucide-react';
import { formatCurrency, formatCurrencyCents } from '@/lib/format';

interface Subscription {
  id: string;
  status: string;
  billing_cycle: string;
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
  const tier1 = Math.min(count, 4);
  total += tier1 * 200;
  if (count > 4) {
    const tier2 = Math.min(count - 4, 5);
    total += tier2 * 150;
  }
  if (count > 9) {
    total += (count - 9) * 100;
  }
  return total;
}

function statusColor(status: string) {
  switch (status) {
    case 'trial': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'active': return 'bg-green-100 text-green-800 border-green-200';
    case 'past_due': return 'bg-red-100 text-red-800 border-red-200';
    case 'canceled': case 'expired': return 'bg-muted text-muted-foreground';
    default: return '';
  }
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SubscriptionPage() {
  const { profile } = useAuthContext();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [aircraftCount, setAircraftCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const [{ data: subData }, { data: acData }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('user_id', profile!.id).maybeSingle(),
        supabase.from('aircrafts').select('id').eq('user_company', profile!.id).eq('is_enabled', true),
      ]);
      setSub(subData as unknown as Subscription);
      setAircraftCount(acData?.length ?? 0);
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const daysLeft = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;

  const monthlyPrice = calcPrice(aircraftCount);
  const fourWeekPrice = monthlyPrice; // per 4-week cycle
  const annualPrice = Math.round(monthlyPrice * 13 * 0.8); // ~13 four-week periods, 20% off

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Subscription</h1>

      {/* Current Plan Card */}
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
                <p className="font-medium text-amber-900">No subscription found</p>
                <p className="text-sm text-amber-700 mt-1">Start your $1 trial to unlock all features for 30 days.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Plane className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Aircraft</p>
                  <p className="font-semibold">{aircraftCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Billing Cycle</p>
                  <p className="font-semibold">{sub.billing_cycle === 'annual' ? 'Annual (20% off)' : 'Every 4 weeks'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {sub.status === 'trial' ? 'Trial Ends' : 'Next Billing'}
                  </p>
                  <p className="font-semibold">
                    {sub.status === 'trial' ? formatDate(sub.trial_ends_at) : formatDate(sub.current_period_end)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-semibold">
                    {sub.status === 'trial' ? '$1.00 trial' : `$${(sub.monthly_amount_cents / 100).toLocaleString()}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons — placeholder until Stripe is wired */}
          <div className="flex gap-3 pt-2">
            {!sub && (
              <Button className="flex-1">
                Start $1 Trial
              </Button>
            )}
            {sub?.status === 'trial' && (
              <Button className="flex-1">
                Add Payment Method
              </Button>
            )}
            {sub?.status === 'active' && (
              <Button variant="outline" className="flex-1">
                Manage Payment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {PRICING_TIERS.map((tier) => (
              <div key={tier.range} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-foreground">{tier.range}</span>
                <span className="text-sm font-semibold">${tier.perPlane}/plane per cycle</span>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-secondary/50 rounded-lg space-y-2">
            <p className="text-sm font-medium text-foreground">Your estimate ({aircraftCount} aircraft):</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Every 4 weeks</span>
              <span className="font-semibold">${fourWeekPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Annual (20% off)</span>
              <span className="font-semibold text-green-600">${annualPrice.toLocaleString()}/yr</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DollarSign(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
