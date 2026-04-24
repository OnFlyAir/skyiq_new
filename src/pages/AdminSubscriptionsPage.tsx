import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, Loader2, Users, DollarSign, AlertTriangle, Shield } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyCents } from '@/lib/format';

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

  const isAdmin = profile?.role_name === 'Admin';

  useEffect(() => {
    if (!isAdmin) return;
    async function load() {
      const { data: subs } = await supabase.from('subscriptions').select('*');
      const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, company, email');

      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

      const mapped: SubRow[] = (subs ?? []).map((s: any) => {
        const p = profileMap.get(s.user_id);
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
        };
      });

      setRows(mapped);
      setLoading(false);
    }
    load();
  }, [isAdmin]);

  async function handleCancel(subId: string) {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'canceled' as any, canceled_at: new Date().toISOString() } as any)
      .eq('id', subId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRows(prev => prev.map(r => r.id === subId ? { ...r, status: 'canceled' } : r));
      toast({ title: 'Subscription canceled' });
    }
  }

  async function handleReactivate(subId: string) {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'active' as any, canceled_at: null } as any)
      .eq('id', subId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRows(prev => prev.map(r => r.id === subId ? { ...r, status: 'active' } : r));
      toast({ title: 'Subscription reactivated' });
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Manage Subscriptions</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
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
                <th className="text-center px-4 py-2.5 font-medium">Aircraft</th>
                <th className="text-center px-4 py-2.5 font-medium">Cycle</th>
                <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                <th className="text-center px-4 py-2.5 font-medium">Ends</th>
                <th className="text-center px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{r.company}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <div>{r.name}</div>
                    <div className="text-xs">{r.email}</div>
                  </td>
                  <td className="px-4 py-2.5 text-center">{statusBadge(r.status)}</td>
                  <td className="px-4 py-2.5 text-center">{r.aircraft_count}</td>
                  <td className="px-4 py-2.5 text-center text-xs">
                    {r.billing_cycle === 'annual' ? 'Annual' : '4-week'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {formatCurrencyCents(r.monthly_amount_cents)}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                    {r.status === 'trial' ? formatDate(r.trial_ends_at) : formatDate(r.current_period_end)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {(r.status === 'active' || r.status === 'trial') && (
                      <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => handleCancel(r.id)}>
                        Cancel
                      </Button>
                    )}
                    {(r.status === 'canceled' || r.status === 'expired') && (
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleReactivate(r.id)}>
                        Reactivate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No subscriptions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
