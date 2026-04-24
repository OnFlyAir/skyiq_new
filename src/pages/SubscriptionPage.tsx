import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Plane, Calendar, AlertCircle, Lock, CheckCircle2, Loader2, ExternalLink, ShieldAlert, FileText, Download } from 'lucide-react';
import { formatCurrency, formatCurrencyCents } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import StripeEmbeddedCheckout from '@/components/StripeEmbeddedCheckout';
import { getStripeEnvironment } from '@/lib/stripe';

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
  stripe_customer_id: string | null;
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
    case 'canceled': return 'bg-gray-100 text-gray-800 border-gray-200';
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
  const [searchParams] = useSearchParams();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [aircraftCount, setAircraftCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [checkoutCycle, setCheckoutCycle] = useState<'four_weekly' | 'annual' | null>(null);
  const [pendingAddons, setPendingAddons] = useState<{ count: number; cents: number }>({ count: 0, cents: 0 });
  const [invoices, setInvoices] = useState<Array<{
    id: string; number: string | null; status: string;
    amount_cents: number; currency: string; created: number;
    pdf_url: string | null; hosted_url: string | null;
  }>>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const canManageBilling = profile?.role_name === 'Admin'
    || profile?.role_name === 'Dev'
    || !!profile?.is_billing_manager;

  const isExempt = profile?.role_name === 'Admin' || profile?.role_name === 'Dev';
  const isBlocked = profile?.is_enabled === false && !isExempt;
  const showCheckoutBanner = searchParams.get('blocked') === '1';
  const checkoutReturn = searchParams.get('checkout') === 'return';

  async function load() {
    if (!profile) return;
    const [subRes, acRes, chargesRes] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('user_id', profile.id).maybeSingle(),
      supabase.from('aircrafts').select('id').eq('user_company', profile.id).eq('is_enabled', true),
      (supabase.from('dfy_usage_charges' as any) as any)
        .select('amount_cents')
        .eq('user_id', profile.id)
        .eq('status', 'pending_invoice'),
    ]);
    setSub(subRes.data as unknown as Subscription);
    setAircraftCount(acRes.data?.length ?? 0);
    const charges = (chargesRes.data ?? []) as Array<{ amount_cents: number }>;
    setPendingAddons({
      count: charges.length,
      cents: charges.reduce((s, c) => s + (c.amount_cents ?? 0), 0),
    });
    setLoading(false);
  }

  async function loadInvoices() {
    if (!profile || invoicesLoading) return;
    setInvoicesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-invoices', {
        body: { environment: getStripeEnvironment(), limit: 24 },
      });
      if (error) throw error;
      setInvoices(((data as any)?.invoices ?? []));
    } catch (e) {
      console.error('list-invoices failed', e);
    } finally {
      setInvoicesLoading(false);
    }
  }

  useEffect(() => { load(); }, [profile?.id]);
  useEffect(() => {
    if (sub?.stripe_customer_id) loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.stripe_customer_id]);

  useEffect(() => {
    if (checkoutReturn) {
      const t = setTimeout(load, 3000);
      return () => clearTimeout(t);
    }
  }, [checkoutReturn]);

  async function startCheckout(cycle: 'four_weekly' | 'annual') {
    if (isExempt) {
      setActing(true);
      try {
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { cycle, return_url: `${window.location.origin}/subscription`, environment: getStripeEnvironment() },
        });
        if (error) throw error;
        if (data?.bypassed) {
          toast({ title: 'Account activated', description: 'No billing required for your role.' });
          await load();
        }
      } catch (e) {
        toast({ title: 'Error', description: e instanceof Error ? e.message : 'Checkout failed', variant: 'destructive' });
      } finally { setActing(false); }
      return;
    }
    setCheckoutCycle(cycle);
  }

  async function openBillingPortal() {
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { return_url: `${window.location.origin}/subscription`, environment: getStripeEnvironment() },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to open portal', variant: 'destructive' });
    } finally { setActing(false); }
  }

  async function scheduleCycleSwitch(target: 'four_weekly' | 'annual') {
    if (!sub) return;
    setActing(true);
    const { error } = await supabase.from('subscriptions').update({ pending_billing_cycle: target } as any).eq('id', sub.id);
    setActing(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSub({ ...sub, pending_billing_cycle: target });
      toast({ title: 'Change scheduled', description: `Switching at next renewal.` });
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  // Non-billing user view
  if (!canManageBilling) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
        {isBlocked && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
            <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Account access paused</p>
              <p className="text-sm text-red-700 mt-1">Your account has been disabled due to a billing issue. Please contact your billing administrator.</p>
            </div>
          </div>
        )}
        <Card><CardContent className="pt-6">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/50 border">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Billing is managed by your account administrator</p>
              <p className="text-sm text-muted-foreground mt-1">Reach out to your admin for plan or payment changes.</p>
            </div>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  // Checkout overlay
  if (checkoutCycle) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Complete your subscription</h1>
          <Button variant="ghost" onClick={() => setCheckoutCycle(null)}>Back</Button>
        </div>
        <StripeEmbeddedCheckout
          cycle={checkoutCycle}
          onBypass={async () => { setCheckoutCycle(null); await load(); }}
          onError={(msg) => { toast({ title: 'Checkout error', description: msg, variant: 'destructive' }); setCheckoutCycle(null); }}
        />
      </div>
    );
  }

  const daysLeft = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;
  const fourWeekPrice = calcPrice(aircraftCount);
  const annualPrice = Math.round(fourWeekPrice * 13 * 0.8);
  const needsReactivate = sub && (sub.status === 'canceled' || sub.status === 'expired' || sub.status === 'past_due');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Subscription</h1>

      {(showCheckoutBanner || isBlocked) && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
          <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Account access paused</p>
            <p className="text-sm text-red-700 mt-1">
              {sub?.status === 'past_due'
                ? 'Your last payment failed. Update your card to restore access.'
                : 'Your subscription is canceled. Resubscribe below to restore access.'}
            </p>
          </div>
        </div>
      )}

      {isExempt && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-green-900">Your <strong>{profile?.role_name}</strong> account is billing-exempt.</span>
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
                <p className="text-sm text-amber-700 mt-1">{isExempt ? 'Click below to activate your account.' : 'Pay $1 today to unlock 4 weeks of full access.'}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Stat icon={<Plane className="h-5 w-5 text-muted-foreground" />} label="Aircraft" value={aircraftCount} />
              <Stat icon={<CreditCard className="h-5 w-5 text-muted-foreground" />} label="Billing Cycle"
                value={sub.billing_cycle === 'annual' ? 'Annual (20% off)' : 'Every 4 weeks'} />
              <Stat icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
                label={sub.status === 'trial' ? 'Trial Ends' : 'Next Billing'}
                value={formatDate(sub.status === 'trial' ? sub.trial_ends_at : sub.current_period_end)} />
              <Stat icon={<CreditCard className="h-5 w-5 text-muted-foreground" />} label="Amount"
                value={sub.status === 'trial' ? `${formatCurrency(1)} trial` : formatCurrencyCents(sub.monthly_amount_cents)} />
            </div>
          )}

          {pendingAddons.count > 0 && (
            <div className="text-sm p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900">
              <span className="font-medium">Add-ons this period:</span> Fuel Planning (DFY) ×{' '}
              {pendingAddons.count} = <strong>{formatCurrencyCents(pendingAddons.cents)}</strong>
              <span className="text-emerald-700"> — added to your next invoice on {formatDate(sub?.current_period_end ?? null)}.</span>
            </div>
          )}

          {sub?.pending_billing_cycle && sub.pending_billing_cycle !== sub.billing_cycle && (
            <div className="text-xs p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-900">
              <span className="font-medium">Scheduled change:</span> switching to{' '}
              {sub.pending_billing_cycle === 'annual' ? 'annual (20% off)' : 'every 4 weeks'} on {formatDate(sub.current_period_end)}.
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {(!sub || needsReactivate) && !isExempt && (
              <>
                <Button onClick={() => startCheckout('four_weekly')} disabled={acting} className="flex-1 min-w-[180px]">
                  {needsReactivate ? 'Resubscribe · 4-week' : 'Start $1 Trial · 4-week'}
                </Button>
                <Button onClick={() => startCheckout('annual')} disabled={acting} variant="outline" className="flex-1 min-w-[180px]">
                  {needsReactivate ? 'Resubscribe · Annual (20% off)' : 'Start $1 Trial · Annual (20% off)'}
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
                  <Button onClick={() => scheduleCycleSwitch('annual')} disabled={acting} variant="outline">
                    Switch to annual (save 20%)
                  </Button>
                )}
                {sub.billing_cycle === 'annual' && sub.pending_billing_cycle !== 'four_weekly' && (
                  <Button onClick={() => scheduleCycleSwitch('four_weekly')} disabled={acting} variant="outline">
                    Switch to 4-week billing
                  </Button>
                )}
                {sub.stripe_customer_id && (
                  <Button onClick={openBillingPortal} disabled={acting} variant="outline" className="gap-1.5">
                    <ExternalLink className="h-4 w-4" /> Manage billing
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
          <p className="text-xs text-muted-foreground">Aircraft changes prorate to your next invoice automatically.</p>
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
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Every 4 weeks</span><span className="font-semibold">{formatCurrency(fourWeekPrice)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Annual (20% off)</span><span className="font-semibold text-green-600">{formatCurrency(annualPrice)}/yr</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Past invoices (Stripe-hosted PDFs) */}
      {sub?.stripe_customer_id && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Invoices</CardTitle>
              <p className="text-xs text-muted-foreground">Official PDF invoices generated by Stripe each billing cycle.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={loadInvoices} disabled={invoicesLoading}>
              {invoicesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
            </Button>
          </CardHeader>
          <CardContent>
            {invoicesLoading && invoices.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No invoices yet — your first one will appear here after your first billing cycle.
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Invoice</th>
                      <th className="text-left px-3 py-2 font-medium">Date</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-right px-3 py-2 font-medium">Amount</th>
                      <th className="text-right px-3 py-2 font-medium">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{inv.number ?? inv.id.slice(0, 12)}</td>
                        <td className="px-3 py-2">{new Date(inv.created * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            inv.status === 'paid' ? 'bg-green-50 border-green-200 text-green-800'
                            : inv.status === 'open' ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : inv.status === 'void' || inv.status === 'uncollectible' ? 'bg-red-50 border-red-200 text-red-800'
                            : 'bg-muted text-muted-foreground'
                          }`}>{inv.status}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrencyCents(inv.amount_cents)}</td>
                        <td className="px-3 py-2 text-right">
                          {inv.pdf_url ? (
                            <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1 text-primary hover:underline">
                              <Download className="h-3.5 w-3.5" /> PDF
                            </a>
                          ) : inv.hosted_url ? (
                            <a href={inv.hosted_url} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1 text-primary hover:underline">
                              <FileText className="h-3.5 w-3.5" /> View
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              To change where future invoices are sent, update your billing email via <span className="font-medium">Manage billing</span> above.
            </p>
          </CardContent>
        </Card>
      )}
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
