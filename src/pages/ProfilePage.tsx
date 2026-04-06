import { useState, FormEvent, useEffect } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, Operator } from '@/types/database';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuthContext();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [operator, setOperator] = useState<Operator | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pilots, setPilots] = useState<Profile[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'pilot' | 'operator_admin'>('pilot');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (profile) { setFirstName(profile.first_name); setLastName(profile.last_name); loadOperatorData(); }
  }, [profile]);

  async function loadOperatorData() {
    if (!profile?.operator_id) return;
    const [opRes, pilotsRes] = await Promise.all([
      supabase.from('operators').select('*').eq('id', profile.operator_id).single(),
      supabase.from('profiles').select('*').eq('operator_id', profile.operator_id).order('last_name'),
    ]);
    if (opRes.data) setOperator(opRes.data);
    if (pilotsRes.data) setPilots(pilotsRes.data as Profile[]);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('profiles').update({ first_name: firstName, last_name: lastName }).eq('id', profile!.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!profile?.operator_id || !inviteEmail) return;
    setInviting(true);
    await supabase.from('operator_invites').insert({ operator_id: profile.operator_id, email: inviteEmail, role: inviteRole, invited_by: profile.id });
    setInviteEmail('');
    setInviting(false);
  }

  async function updatePilotRole(pilotId: string, newRole: 'operator_admin' | 'pilot') {
    await supabase.from('profiles').update({ role: newRole }).eq('id', pilotId);
    setPilots((prev) => prev.map((p) => (p.id === pilotId ? { ...p, role: newRole } : p)));
  }

  const isAdmin = profile?.role === 'operator_admin' || profile?.role === 'super_admin';
  const inputCls = "flex-1 px-3 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";
  const disabledCls = "flex-1 px-3 py-2.5 bg-secondary rounded-lg text-sm text-muted-foreground border border-border";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Edit User</h1>

      <form onSubmit={handleSave} className="space-y-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="sm:w-32 text-sm font-medium text-foreground/80">First Name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="sm:w-32 text-sm font-medium text-foreground/80">Last Name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="sm:w-32 text-sm font-medium text-foreground/80">Email</label>
          <input value={profile?.email || ''} disabled className={disabledCls} />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="sm:w-32 text-sm font-medium text-foreground/80">Company</label>
          <input value={operator?.name || ''} disabled className={disabledCls} />
        </div>

        <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all">
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      {isAdmin && (
        <>
          <h2 className="text-xl font-bold text-foreground mb-4">Team Roster</h2>

          <div className="space-y-2 mb-6">
            {pilots.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
                <select
                  value={p.role}
                  onChange={(e) => updatePilotRole(p.id, e.target.value as any)}
                  disabled={p.id === profile?.id}
                  className="text-xs px-2 py-1 border border-border rounded bg-secondary/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="pilot">Pilot</option>
                  <option value="operator_admin">Admin</option>
                </select>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-foreground/80 mb-2">Invite a team member</h3>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-secondary/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="pilot">Pilot</option>
              <option value="operator_admin">Admin</option>
            </select>
            <button type="submit" disabled={inviting} className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all">
              {inviting ? 'Inviting...' : 'Invite'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
