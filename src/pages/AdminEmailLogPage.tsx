// Admin-only page that shows the billing email send log.
// Failures float to the top so admins can see Resend 403s, missing keys, etc.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle2, Mail, RefreshCw, ChevronLeft } from 'lucide-react';

interface EmailLogRow {
  id: string;
  user_id: string | null;
  recipient_email: string;
  email_type: string;
  status: 'sent' | 'failed';
  error_message: string | null;
  provider_response: string | null;
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  trial_started: 'Trial Started',
  trial_ending: 'Trial Ending',
  payment_failed: 'Payment Failed',
  subscription_canceled: 'Subscription Canceled',
  plan_changed: 'Plan Changed',
};

export default function AdminEmailLogPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAdmin = profile?.role_name === 'Admin';

  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'failed' | 'unack'>('unack');
  const [sendingTest, setSendingTest] = useState(false);

  async function sendTestSuite() {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-billing-emails', {
        body: {},
      });
      if (error) {
        toast({ title: 'Test failed', description: error.message, variant: 'destructive' });
      } else {
        const results = (data as any)?.results ?? [];
        const okCount = results.filter((r: any) => r.ok).length;
        const failCount = results.length - okCount;
        toast({
          title: failCount === 0 ? 'All test emails sent ✓' : `${okCount} sent, ${failCount} failed`,
          description: `Sent to ${(data as any)?.recipient}. Check inbox & log below.`,
          variant: failCount === 0 ? 'default' : 'destructive',
        });
        load();
      }
    } catch (e: any) {
      toast({ title: 'Test failed', description: e.message, variant: 'destructive' });
    } finally {
      setSendingTest(false);
    }
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('billing_email_log' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: 'Failed to load logs', description: error.message, variant: 'destructive' });
    } else {
      setRows((data as unknown as EmailLogRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!isAdmin) return;
    load();
    // Realtime: refresh on any new failure or status change
    const channel = supabase
      .channel('billing_email_log_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'billing_email_log' }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function acknowledge(id: string) {
    const { error } = await supabase
      .from('billing_email_log' as any)
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: profile?.id,
      } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } else {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, acknowledged: true } : r)));
    }
  }

  async function acknowledgeAll() {
    const ids = rows.filter((r) => r.status === 'failed' && !r.acknowledged).map((r) => r.id);
    if (!ids.length) return;
    const { error } = await supabase
      .from('billing_email_log' as any)
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: profile?.id,
      } as any)
      .in('id', ids);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } else {
      load();
      toast({ title: `${ids.length} alerts acknowledged` });
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'failed') return rows.filter((r) => r.status === 'failed');
    return rows.filter((r) => r.status === 'failed' && !r.acknowledged);
  }, [rows, filter]);

  const stats = useMemo(() => {
    const failed = rows.filter((r) => r.status === 'failed').length;
    const unack = rows.filter((r) => r.status === 'failed' && !r.acknowledged).length;
    const sent = rows.filter((r) => r.status === 'sent').length;
    return { failed, unack, sent };
  }, [rows]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center p-8">
        <h1 className="text-2xl font-bold mb-2">Admins only</h1>
        <p className="text-muted-foreground mb-6">You don't have access to this page.</p>
        <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/subscriptions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Subscriptions
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Billing Email Alerts</h1>
          <p className="text-muted-foreground mt-1">
            Failed sends from Resend (403 errors, missing keys, suppressed addresses, etc.)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={sendTestSuite} disabled={sendingTest}>
            <Mail className={`h-4 w-4 mr-2 ${sendingTest ? 'animate-pulse' : ''}`} />
            {sendingTest ? 'Sending…' : 'Send test emails'}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {stats.unack > 0 && (
            <Button size="sm" onClick={acknowledgeAll}>
              Acknowledge all ({stats.unack})
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Unacknowledged failures"
          value={stats.unack}
          icon={AlertTriangle}
          tone={stats.unack > 0 ? 'danger' : 'muted'}
        />
        <StatCard label="Total failures" value={stats.failed} icon={AlertTriangle} tone="warning" />
        <StatCard label="Successful sends" value={stats.sent} icon={CheckCircle2} tone="success" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 border-b border-border pb-3">
        {(['unack', 'failed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            {f === 'unack' ? 'Needs attention' : f === 'failed' ? 'All failures' : 'All activity'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {filter === 'unack' ? 'No unacknowledged failures. 🎉' : 'No entries to show.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((row) => (
              <div key={row.id} className="p-4 hover:bg-secondary/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {row.status === 'failed' ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Failed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3" /> Sent
                        </Badge>
                      )}
                      <span className="text-sm font-medium">
                        {TYPE_LABELS[row.email_type] ?? row.email_type}
                      </span>
                      {row.acknowledged && (
                        <Badge variant="outline" className="text-xs">Acknowledged</Badge>
                      )}
                    </div>
                    <div className="mt-1.5 text-sm text-muted-foreground">
                      To: <span className="font-mono text-foreground">{row.recipient_email}</span>
                    </div>
                    {row.error_message && (
                      <div className="mt-2 text-sm text-destructive font-medium">
                        {row.error_message}
                      </div>
                    )}
                    {row.provider_response && row.status === 'failed' && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Provider response
                        </summary>
                        <pre className="mt-2 text-xs bg-secondary/50 p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
                          {row.provider_response}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    <div>{new Date(row.created_at).toLocaleString()}</div>
                    {row.status === 'failed' && !row.acknowledged && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => acknowledge(row.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: 'danger' | 'warning' | 'success' | 'muted';
}) {
  const toneClasses = {
    danger: 'border-destructive/30 bg-destructive/5 text-destructive',
    warning: 'border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400',
    success: 'border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400',
    muted: 'border-border bg-secondary/30 text-muted-foreground',
  }[tone];
  return (
    <div className={`rounded-lg border p-4 ${toneClasses}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-foreground">{value}</div>
    </div>
  );
}
