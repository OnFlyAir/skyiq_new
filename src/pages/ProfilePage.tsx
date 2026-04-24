import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Plane, Database, CreditCard, Mail, AlertTriangle, RefreshCw, Bell } from 'lucide-react';

type EmailPref = 'all' | 'critical' | 'changes' | 'none';

const EMAIL_PREF_OPTIONS: { value: EmailPref; label: string; description: string; icon: typeof Mail }[] = [
  { value: 'all', label: 'All billing emails', description: 'Trial updates, payment failures, cancellations, and plan changes.', icon: Bell },
  { value: 'changes', label: 'Critical + plan changes', description: 'Payment failures, cancellations, and any plan updates. No trial reminders.', icon: RefreshCw },
  { value: 'critical', label: 'Critical only', description: 'Just payment failures and subscription cancellations.', icon: AlertTriangle },
  { value: 'none', label: 'None', description: 'Mute all billing emails. You may miss important account notices.', icon: Mail },
];

type AdminStats = {
  totalUsers: number;
  totalTrips: number;
  activeSubs: number;
  onflyRecords: number;
};

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [emailPref, setEmailPref] = useState<EmailPref>('all');
  const [savingPref, setSavingPref] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalUsers: 0,
    totalTrips: 0,
    activeSubs: 0,
    onflyRecords: 0,
  });

  const isAdmin = profile?.role_name === 'Admin';

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name);
      setLastName(profile.last_name);
      setCompany(profile.company || '');
      setEmailPref(((profile as any).billing_email_preference as EmailPref) || 'all');
    }
  }, [profile]);

  async function updateEmailPref(next: EmailPref) {
    if (!profile || next === emailPref) return;
    setSavingPref(true);
    setEmailPref(next);
    const { error } = await supabase
      .from('profiles')
      .update({ billing_email_preference: next } as any)
      .eq('id', profile.id);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      setEmailPref(((profile as any).billing_email_preference as EmailPref) || 'all');
    } else {
      await refreshProfile();
      toast({ title: 'Email preference updated' });
    }
    setSavingPref(false);
  }

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    async function loadAdminStats() {
      setStatsLoading(true);
      const [profilesRes, tripsRes, subsRes, onflyRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('trips').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('status'),
        supabase.from('onfly_data').select('id', { count: 'exact', head: true }),
      ]);

      if (cancelled) return;

      const subscriptions = subsRes.data ?? [];
      setAdminStats({
        totalUsers: profilesRes.count ?? 0,
        totalTrips: tripsRes.count ?? 0,
        activeSubs: subscriptions.filter((sub) => sub.status === 'active' || sub.status === 'trial').length,
        onflyRecords: onflyRes.count ?? 0,
      });
      setStatsLoading(false);
    }

    loadAdminStats();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    await supabase.from('profiles').update({ first_name: firstName, last_name: lastName, company } as any).eq('id', profile.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputCls = 'flex-1 rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40';
  const disabledCls = 'flex-1 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-muted-foreground';
  const statValue = (value: number) => (statsLoading ? '—' : value.toLocaleString());

  if (isAdmin) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit gap-2 border-primary/20 bg-primary/10 text-primary">
              <Shield className="h-3.5 w-3.5" />
              Admin Account
            </Badge>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Platform Control Center</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                This profile is configured for internal operations, not the standard customer workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/admin')}>Open Admin Panel</Button>
            <Button variant="outline" onClick={() => navigate('/admin?tab=onfly')}>OnFly Data</Button>
            <Button variant="outline" onClick={() => navigate('/admin/dfy')}>DFY Service</Button>
            <Button variant="outline" onClick={() => navigate('/admin/subscriptions')}>Subscriptions</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <Users className="mx-auto mb-2 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold text-foreground">{statValue(adminStats.totalUsers)}</p>
              <p className="text-xs text-muted-foreground">Platform Users</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Plane className="mx-auto mb-2 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold text-foreground">{statValue(adminStats.totalTrips)}</p>
              <p className="text-xs text-muted-foreground">Trips Processed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <CreditCard className="mx-auto mb-2 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold text-foreground">{statValue(adminStats.activeSubs)}</p>
              <p className="text-xs text-muted-foreground">Active Subscriptions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Database className="mx-auto mb-2 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold text-foreground">{statValue(adminStats.onflyRecords)}</p>
              <p className="text-xs text-muted-foreground">OnFly Records</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Admin account details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="text-sm font-medium text-foreground/80 sm:w-32">First Name</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="text-sm font-medium text-foreground/80 sm:w-32">Last Name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="text-sm font-medium text-foreground/80 sm:w-32">Email</label>
                  <input value={profile?.email || ''} disabled className={disabledCls} />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="text-sm font-medium text-foreground/80 sm:w-32">Role</label>
                  <input value="Administrator" disabled className={disabledCls} />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="text-sm font-medium text-foreground/80 sm:w-32">Company</label>
                  <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} />
                </div>

                <Button type="submit" disabled={saving}>
                  {saved ? 'Saved!' : saving ? 'Saving...' : 'Save changes'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Admin scope</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="font-medium text-foreground">Users and subscriptions</p>
                  <p>Review every customer account, subscription state, and usage summary from the admin console.</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="font-medium text-foreground">OnFly itinerary archive</p>
                  <p>Access uploaded itineraries, parsed client name, email, phone, and CSV export from one place.</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="font-medium text-foreground">DFY operations</p>
                  <p>Open the DFY service workspace to track requests, clients, sent itineraries, and fuel work.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Edit Profile</h1>

      <form onSubmit={handleSave} className="mb-8 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-foreground/80 sm:w-32">First Name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-foreground/80 sm:w-32">Last Name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-foreground/80 sm:w-32">Email</label>
          <input value={profile?.email || ''} disabled className={disabledCls} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-foreground/80 sm:w-32">Company</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} />
        </div>

        <Button type="submit" disabled={saving}>
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
