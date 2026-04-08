import { useState, FormEvent, useEffect } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuthContext();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name);
      setLastName(profile.last_name);
      setCompany(profile.company || '');
    }
  }, [profile]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('profiles').update({ first_name: firstName, last_name: lastName, company } as any).eq('id', profile!.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputCls = "flex-1 px-3 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";
  const disabledCls = "flex-1 px-3 py-2.5 bg-secondary rounded-lg text-sm text-muted-foreground border border-border";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Edit Profile</h1>

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
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} />
        </div>

        <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all">
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
