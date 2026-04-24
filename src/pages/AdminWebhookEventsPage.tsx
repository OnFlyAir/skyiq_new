// Admin-only page that shows recent Stripe webhook events.
// Failures float to the top so admins can spot broken webhooks quickly.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ChevronLeft, Zap } from 'lucide-react';

interface WebhookEventRow {
  id: string;
  stripe_event_id: string | null;
  event_type: string;
  environment: string;
  status: 'received' | 'processed' | 'failed';
  error_message: string | null;
  user_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  amount_cents: number | null;
  received_at: string;
  processed_at: string | null;
  payload: any;
}

export default function AdminWebhookEventsPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const isAdmin = profile?.role_name === 'Admin';

  const [rows, setRows] = useState<WebhookEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'failed' | 'live' | 'sandbox'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !isAdmin) navigate('/dashboard', { replace: true });
  }, [profile, isAdmin, navigate]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('stripe_webhook_events' as any)
      .select('*')
      .order('received_at', { ascending: false })
      .limit(200);
    if (!error && data) setRows(data as unknown as WebhookEventRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'failed') return r.status === 'failed';
      if (filter === 'live') return r.environment === 'live';
      if (filter === 'sandbox') return r.environment === 'sandbox';
      return true;
    });
  }, [rows, filter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const failed = rows.filter((r) => r.status === 'failed').length;
    const live = rows.filter((r) => r.environment === 'live').length;
    return { total, failed, live };
  }, [rows]);

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin"><ChevronLeft className="h-4 w-4 mr-1" />Admin</Link>
        </Button>
      </div>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-7 w-7" />
            Transaction History
          </h1>
          <p className="text-muted-foreground mt-1">
            Recent Stripe webhook events and whether each was processed successfully.
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total events</div>
          <div className="text-2xl font-semibold">{stats.total}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Live mode</div>
          <div className="text-2xl font-semibold">{stats.live}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Failed</div>
          <div className={`text-2xl font-semibold ${stats.failed > 0 ? 'text-destructive' : ''}`}>
            {stats.failed}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'failed', 'live', 'sandbox'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          No webhook events yet. They'll appear here after Stripe sends activity.
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {filtered.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="p-4">
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="w-full flex items-start justify-between gap-4 text-left"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {r.status === 'processed' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    ) : r.status === 'failed' ? (
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-medium truncate">{r.event_type}</code>
                        <Badge variant={r.environment === 'live' ? 'default' : 'secondary'}>
                          {r.environment}
                        </Badge>
                        <Badge
                          variant={
                            r.status === 'failed'
                              ? 'destructive'
                              : r.status === 'processed'
                              ? 'outline'
                              : 'secondary'
                          }
                        >
                          {r.status}
                        </Badge>
                        {typeof r.amount_cents === 'number' && r.amount_cents > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ${(r.amount_cents / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(r.received_at).toLocaleString()}
                        {r.stripe_event_id && (
                          <span className="ml-2 font-mono">{r.stripe_event_id}</span>
                        )}
                      </div>
                      {r.error_message && (
                        <div className="text-xs text-destructive mt-1 break-words">
                          {r.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t space-y-2 text-xs">
                    {r.user_id && (
                      <div>
                        <span className="text-muted-foreground">User ID:</span>{' '}
                        <code>{r.user_id}</code>
                      </div>
                    )}
                    {r.stripe_customer_id && (
                      <div>
                        <span className="text-muted-foreground">Customer:</span>{' '}
                        <code>{r.stripe_customer_id}</code>
                      </div>
                    )}
                    {r.stripe_subscription_id && (
                      <div>
                        <span className="text-muted-foreground">Subscription:</span>{' '}
                        <code>{r.stripe_subscription_id}</code>
                      </div>
                    )}
                    {r.processed_at && (
                      <div>
                        <span className="text-muted-foreground">Processed:</span>{' '}
                        {new Date(r.processed_at).toLocaleString()}
                      </div>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-muted-foreground">
                        Raw payload
                      </summary>
                      <pre className="mt-2 p-3 bg-muted rounded overflow-x-auto text-[10px] leading-tight max-h-96">
                        {JSON.stringify(r.payload, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
