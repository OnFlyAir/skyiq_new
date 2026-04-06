import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Users, ArrowLeft } from 'lucide-react';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

export default function OnboardingPage() {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [companyName, setCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useAuthContext();
  const navigate = useNavigate();

  async function handleCreateOperator(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);

    const { data: operator, error: opError } = await supabase
      .from('operators')
      .insert({ name: companyName, created_by: user.id })
      .select()
      .single();

    if (opError) { setError(opError.message); setLoading(false); return; }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ operator_id: operator.id, role: 'operator_admin' })
      .eq('id', user.id);

    if (profileError) { setError(profileError.message); setLoading(false); return; }

    await refreshProfile();
    navigate('/dashboard');
  }

  async function handleJoinOperator(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: invite, error: invError } = await supabase
      .from('operator_invites')
      .select('*')
      .eq('email', user?.email)
      .eq('status', 'pending')
      .single();

    if (invError || !invite) {
      setError('No pending invitation found for your email. Ask your operator admin to send you an invite.');
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ operator_id: invite.operator_id, role: invite.role })
      .eq('id', user!.id);

    if (updateError) { setError(updateError.message); setLoading(false); return; }

    await supabase.from('operator_invites').update({ status: 'accepted' }).eq('id', invite.id);
    await refreshProfile();
    navigate('/dashboard');
  }

  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          <img src={skyiqLogo} alt="SkyIQ" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to SkyIQ</h1>
          <p className="text-muted-foreground mb-8">Let's get you set up</p>

          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full p-6 bg-card border border-border rounded-xl hover:border-primary transition-colors text-left"
            >
              <div className="flex items-start gap-4">
                <Building2 className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground text-lg">Create an Operator Account</h3>
                  <p className="text-sm text-muted-foreground mt-1">I'm setting up my company on SkyIQ</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full p-6 bg-card border border-border rounded-xl hover:border-primary transition-colors text-left"
            >
              <div className="flex items-start gap-4">
                <Users className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground text-lg">Join an Existing Operator</h3>
                  <p className="text-sm text-muted-foreground mt-1">I've been invited by my company</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-bold text-foreground mb-6">Create your operator</h1>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateOperator} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">Company name</label>
              <input
                type="text"
                placeholder="Enter your company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-border rounded-lg text-sm bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {loading ? 'Creating...' : 'Create Operator'}
            </button>
          </form>

          <button
            onClick={() => setMode('choose')}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold text-foreground mb-6">Join your operator</h1>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleJoinOperator} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We'll check for a pending invitation sent to <strong className="text-foreground">{user?.email}</strong>.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {loading ? 'Checking...' : 'Check for invitation'}
          </button>
        </form>

        <button
          onClick={() => setMode('choose')}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      </div>
    </div>
  );
}
