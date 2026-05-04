import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Search, Loader2, Users, DollarSign, AlertTriangle, Shield,
  CheckCircle2, XCircle, MoreHorizontal, UserCheck, UserX, Plane, Trash2,
  RefreshCw, Ban, CalendarClock,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { formatCurrencyCents } from '@/lib/format';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { logAdminAction } from '@/lib/adminAudit';

interface SubRow {
  id: string;
  userId: string;
  name: string;
  company: string;
  email: string;
  status: string;
  billing_cycle: string;
  aircraft_count: number;
  monthly_amount_cents: number;
  trial_ends_at: string;
  current_period_end: string | null;
  is_billing_manager: boolean;
  role_name: string;
  is_enabled: boolean;
  billing_exempt: boolean;
}

const AUTO_DISABLE_STATUSES = new Set(['canceled', 'past_due', 'expired', 'unpaid']);

function accountBadge(isEnabled: boolean, status: string) {
  if (isEnabled) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Enabled
      </Badge>
    );
  }
  const auto = AUTO_DISABLE_STATUSES.has(status);
  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
      <XCircle className="h-3 w-3" />
      {auto ? 'Auto-disabled' : 'Disabled'}
    </Badge>
  );
}

function statusBadge(status: string) {
  switch (status) {
    case 'trial': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Trial</Badge>;
    case 'active': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>;
    case 'past_due': return <Badge variant="destructive">Past Due</Badge>;
    case 'canceled': return <Badge variant="secondary">Canceled</Badge>;
    case 'expired': return <Badge variant="secondary">Expired</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminSubscriptionsPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<SubRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SubRow | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isAdmin = profile?.role_name === 'Admin';

  useEffect(() => {
    if (!isAdmin) return;
    async function load() {
      const { data: subs } = await supabase.from('subscriptions').select('*');
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, company, email, role_name, is_billing_manager, is_enabled, billing_exempt' as any);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      const mapped: SubRow[] = (subs ?? []).map((s: any) => {
        const p: any = profileMap.get(s.user_id);
        return {
          id: s.id,
          userId: s.user_id,
          name: p ? `${p.first_name} ${p.last_name}`.trim() : '—',
          company: p?.company || '—',
          email: p?.email || '—',
          status: s.status,
          billing_cycle: s.billing_cycle,
          aircraft_count: s.aircraft_count,
          monthly_amount_cents: s.monthly_amount_cents,
          trial_ends_at: s.trial_ends_at,
          current_period_end: s.current_period_end,
          is_billing_manager: !!p?.is_billing_manager,
          role_name: p?.role_name || 'User',
          is_enabled: p?.is_enabled !== false,
          billing_exempt: !!p?.billing_exempt,
        };
      });

      setRows(mapped);
      setLoading(false);
    }
    load();
  }, [isAdmin]);

  async function handleCancel(r: SubRow) {
    setBusyId(r.userId);
    const { error } = await supabase.functions.invoke('admin-subscription-action', {
      body: { action: 'cancel', subscription_id: r.id },
    });
    setBusyId(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRows(prev => prev.map(x => x.id === r.id ? { ...x, status: 'canceled' } : x));
      toast({ title: 'Subscription canceled', description: 'Access continues until end of current period.' });
      void logAdminAction({
        action: 'subscription.cancel',
        targetUserId: r.userId, targetLabel: r.email,
        details: { company: r.company, subscription_id: r.id },
      });
    }
  }

  async function handleReactivate(r: SubRow) {
    setBusyId(r.userId);
    const { error } = await supabase.functions.invoke('admin-subscription-action', {
      body: { action: 'reactivate', subscription_id: r.id },
    });
    setBusyId(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRows(prev => prev.map(x => x.id === r.id ? { ...x, status: 'active', is_enabled: true } : x));
      toast({ title: 'Subscription reactivated' });
      void logAdminAction({
        action: 'subscription.reactivate',
        targetUserId: r.userId, targetLabel: r.email,
        details: { company: r.company, subscription_id: r.id },
      });
    }
  }

  async function toggleBillingManager(r: SubRow) {
    setBusyId(r.userId);
    const next = !r.is_billing_manager;
    const { error } = await supabase
      .from('profiles')
      .update({ is_billing_manager: next } as any)
      .eq('id', r.userId);
    setBusyId(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRows(prev => prev.map(x => x.userId === r.userId ? { ...x, is_billing_manager: next } : x));
      toast({ title: next ? 'Billing access granted' : 'Billing access revoked' });
      void logAdminAction({
        action: next ? 'user.billing_manager_on' : 'user.billing_manager_off',
        targetUserId: r.userId, targetLabel: r.email,
        details: { company: r.company, previous: r.is_billing_manager, next },
      });
    }
  }

  async function setCycle(r: SubRow, cycle: 'four_weekly' | 'annual') {
    setBusyId(r.userId);
    const { error } = await supabase.functions.invoke('admin-subscription-action', {
      body: { action: 'change_cycle', subscription_id: r.id, cycle },
    });
    setBusyId(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRows(prev => prev.map(x => x.id === r.id ? { ...x, billing_cycle: cycle } : x));
      toast({ title: 'Cycle change scheduled', description: 'Applies at next renewal.' });
      void logAdminAction({
        action: 'subscription.change_cycle',
        targetUserId: r.userId, targetLabel: r.email,
        details: { company: r.company, subscription_id: r.id, cycle },
      });
    }
  }

  async function toggleAccountEnabled(r: SubRow) {
    setBusyId(r.userId);
    const next = !r.is_enabled;
    const { error } = await supabase
      .from('profiles')
      .update({ is_enabled: next } as any)
      .eq('id', r.userId);
    setBusyId(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRows(prev => prev.map(x => x.userId === r.userId ? { ...x, is_enabled: next } : x));
      toast({ title: next ? 'Account enabled' : 'Account disabled' });
      void logAdminAction({
        action: next ? 'user.activate' : 'user.deactivate',
        targetUserId: r.userId, targetLabel: r.email,
        details: { company: r.company, previous: r.is_enabled, next },
      });
    }
  }

  async function toggleBillingExempt(r: SubRow) {
    setBusyId(r.userId);
    const next = !r.billing_exempt;
    const { error } = await supabase
      .from('profiles')
      .update({ billing_exempt: next } as any)
      .eq('id', r.userId);
    setBusyId(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setRows(prev => prev.map(x => x.userId === r.userId ? { ...x, billing_exempt: next } : x));
    toast({ title: next ? 'Marked billing-exempt' : 'Billing resumed' });
    void logAdminAction({
      action: next ? 'user.billing_exempt_on' : 'user.billing_exempt_off',
      targetUserId: r.userId, targetLabel: r.email,
      details: { company: r.company, previous: r.billing_exempt, next },
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    setBusyId(target.userId);
    const toastId = sonnerToast.loading(`Deleting ${target.email}…`, {
      description: 'Removing profile, aircraft, trips, subscription, and login.',
    });
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { target_user_id: target.userId },
      });
      const apiError = (data as any)?.error;
      if (error || apiError) {
        const message = apiError || error?.message || 'Unknown error';
        sonnerToast.error(`Failed to delete ${target.email}`, {
          id: toastId,
          description: `${message}. No changes were saved.`,
          duration: 8000,
        });
        return;
      }
      sonnerToast.success(`Deleted ${target.email}`, {
        id: toastId,
        description: 'All associated data has been permanently removed.',
      });
      void logAdminAction({
        action: 'user.delete',
        targetUserId: target.userId, targetLabel: target.email,
        details: {
          company: target.company, name: target.name,
          aircraft_count: target.aircraft_count,
        },
      });
      setRows(prev => prev.filter(r => r.userId !== target.userId));
      setPendingDelete(null);
      setConfirmText('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      sonnerToast.error(`Failed to delete ${target.email}`, {
        id: toastId, description: `${message}. Please try again.`, duration: 8000,
      });
    } finally {
      setDeleting(false);
      setBusyId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center p-8">
        <h1 className="text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Admin access required.</p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">Back to Dashboard</Button>
      </div>
    );
  }

  const filtered = rows.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.company.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalMRR = rows.filter(r => r.status === 'active').reduce((s, r) => s + r.monthly_amount_cents, 0);
  const trialCount = rows.filter(r => r.status === 'trial').length;
  const pastDueCount = rows.filter(r => r.status === 'past_due').length;
  const autoDisabledCount = rows.filter(r => !r.is_enabled && AUTO_DISABLE_STATUSES.has(r.status)).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Manage Subscriptions</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-2xl font-bold text-green-600">{formatCurrencyCents(totalMRR)}</p>
            <p className="text-xs text-muted-foreground">Active MRR</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-amber-600" />
            <p className="text-2xl font-bold">{trialCount}</p>
            <p className="text-xs text-muted-foreground">Active Trials</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold text-red-500">{pastDueCount}</p>
            <p className="text-xs text-muted-foreground">Past Due</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <XCircle className="h-5 w-5 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold text-red-500">{autoDisabledCount}</p>
            <p className="text-xs text-muted-foreground">Auto-disabled</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, company, or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Company</th>
                <th className="text-left px-4 py-2.5 font-medium">Contact</th>
                <th className="text-center px-4 py-2.5 font-medium">Status</th>
                <th className="text-center px-4 py-2.5 font-medium">Account</th>
                <th className="text-center px-4 py-2.5 font-medium">Billing</th>
                <th className="text-center px-4 py-2.5 font-medium">Fleet</th>
                <th className="text-center px-4 py-2.5 font-medium">Cycle</th>
                <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                <th className="text-center px-4 py-2.5 font-medium">Ends</th>
                <th className="text-center px-4 py-2.5 font-medium">
                  <span className="inline-flex items-center gap-1"><Shield className="h-3 w-3" />Billing Mgr</span>
                </th>
                <th className="text-center px-4 py-2.5 font-medium w-12">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const isProtected = r.role_name === 'Admin' || r.role_name === 'Dev';
                return (
                  <tr key={r.id} className="border-t hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{r.company}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <div>{r.name} <span className="text-[10px] uppercase tracking-wide text-muted-foreground">({r.role_name})</span></div>
                      <div className="text-xs">{r.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center">{statusBadge(r.status)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {isProtected ? (
                        <Badge variant="outline" className="bg-secondary text-muted-foreground gap-1">
                          <Shield className="h-3 w-3" /> Exempt
                        </Badge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleAccountEnabled(r)}
                          title={r.is_enabled ? 'Click to disable account' : 'Click to enable account'}
                          className="hover:opacity-80 transition-opacity"
                        >
                          {accountBadge(r.is_enabled, r.status)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={!r.billing_exempt}
                          onCheckedChange={() => toggleBillingExempt(r)}
                          disabled={busyId === r.userId || isProtected}
                          aria-label="Bill this user"
                        />
                        <span className="text-xs text-muted-foreground">
                          {r.billing_exempt || isProtected ? 'Exempt' : 'On'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Link to={`/admin/users/${r.userId}/fleet`} className="text-primary hover:underline">
                        {r.aircraft_count}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      <select
                        value={r.billing_cycle}
                        onChange={(e) => setCycle(r, e.target.value as 'four_weekly' | 'annual')}
                        className="bg-background border border-border rounded px-1.5 py-0.5 text-xs"
                        disabled={busyId === r.userId}
                      >
                        <option value="four_weekly">4-week</option>
                        <option value="annual">Annual</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {formatCurrencyCents(r.monthly_amount_cents)}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                      {r.status === 'trial' ? formatDate(r.trial_ends_at) : formatDate(r.current_period_end)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isProtected ? (
                        <span className="text-[10px] text-muted-foreground">auto</span>
                      ) : (
                        <Switch
                          checked={r.is_billing_manager}
                          onCheckedChange={() => toggleBillingManager(r)}
                          disabled={busyId === r.userId}
                        />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busyId === r.userId}>
                            {busyId === r.userId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Account</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => toggleAccountEnabled(r)} disabled={isProtected}>
                            {r.is_enabled ? (
                              <><UserX className="h-4 w-4 mr-2" /> Deactivate account</>
                            ) : (
                              <><UserCheck className="h-4 w-4 mr-2" /> Activate account</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleBillingExempt(r)} disabled={isProtected}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            {r.billing_exempt ? 'Resume billing' : 'Mark billing-exempt'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleBillingManager(r)} disabled={isProtected}>
                            <Shield className="h-4 w-4 mr-2" />
                            {r.is_billing_manager ? 'Revoke billing manager' : 'Grant billing manager'}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/users/${r.userId}/fleet`}>
                              <Plane className="h-4 w-4 mr-2" /> Manage aircraft fleet
                            </Link>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Subscription</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => setCycle(r, r.billing_cycle === 'annual' ? 'four_weekly' : 'annual')}
                          >
                            <CalendarClock className="h-4 w-4 mr-2" />
                            Switch to {r.billing_cycle === 'annual' ? '4-week' : 'annual'} cycle
                          </DropdownMenuItem>
                          {(r.status === 'active' || r.status === 'trial') && (
                            <DropdownMenuItem onClick={() => handleCancel(r)} className="text-destructive focus:text-destructive">
                              <Ban className="h-4 w-4 mr-2" /> Cancel subscription
                            </DropdownMenuItem>
                          )}
                          {(r.status === 'canceled' || r.status === 'expired') && (
                            <DropdownMenuItem onClick={() => handleReactivate(r)}>
                              <RefreshCw className="h-4 w-4 mr-2" /> Reactivate subscription
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setPendingDelete(r)}
                            className="text-destructive focus:text-destructive"
                            disabled={r.role_name === 'Admin'}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete user
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">No subscriptions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (deleting) return;
          if (!o) { setPendingDelete(null); setConfirmText(''); }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Permanently delete {pendingDelete?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will <strong>permanently remove</strong> the account for{' '}
                  <strong>{pendingDelete?.name || pendingDelete?.email}</strong>
                  {pendingDelete?.company ? <> at <strong>{pendingDelete.company}</strong></> : null}.
                  This action cannot be undone.
                </p>
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <div className="font-medium mb-1 text-destructive">The following will be deleted:</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                    <li>Login &amp; profile</li>
                    <li>{pendingDelete?.aircraft_count ?? 0} aircraft in fleet</li>
                    <li>All saved trips</li>
                    <li>Subscription &amp; billing history</li>
                  </ul>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">
                    Type <code className="px-1 py-0.5 bg-muted rounded">DELETE</code> to confirm
                  </label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    autoComplete="off"
                    disabled={deleting}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting || confirmText !== 'DELETE'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <span className="inline-flex items-center"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting…</span>
              ) : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
