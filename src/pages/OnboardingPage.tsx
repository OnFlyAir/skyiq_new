import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';

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

    // Create operator
    const { data: operator, error: opError } = await supabase
      .from('operators')
      .insert({ name: companyName, created_by: user.id })
      .select()
      .single();

    if (opError) {
      setError(opError.message);
      setLoading(false);
      return;
    }

    // Link profile to operator as admin
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ operator_id: operator.id, role: 'operator_admin' })
      .eq('id', user.id);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    await refreshProfile();
    navigate('/dashboard');
  }

  async function handleJoinOperator(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Check for pending invite matching user's email
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

    // Accept invite
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ operator_id: invite.operator_id, role: invite.role })
      .eq('id', user!.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await supabase
      .from('operator_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    await refreshProfile();
    navigate('/dashboard');
  }

  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to skyIQ</h1>
          <p className="text-gray-600 mb-8">Let's get you set up</p>

          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-skyiq-accent transition-colors text-left"
            >
              <h3 className="font-semibold text-gray-900 text-lg">Create an Operator Account</h3>
              <p className="text-sm text-gray-500 mt-1">I'm setting up my company on skyIQ</p>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-skyiq-accent transition-colors text-left"
            >
              <h3 className="font-semibold text-gray-900 text-lg">Join an Existing Operator</h3>
              <p className="text-sm text-gray-500 mt-1">I've been invited by my company</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Create your operator</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateOperator} className="space-y-4">
            <input
              type="text"
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-skyiq-accent"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-skyiq-accent text-white font-medium rounded-lg hover:bg-skyiq-accent/90 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Operator'}
            </button>
          </form>

          <button
            onClick={() => setMode('choose')}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Join your operator</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleJoinOperator} className="space-y-4">
          <p className="text-sm text-gray-600">
            We'll check for a pending invitation sent to <strong>{user?.email}</strong>.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-skyiq-accent text-white font-medium rounded-lg hover:bg-skyiq-accent/90 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check for invitation'}
          </button>
        </form>

        <button
          onClick={() => setMode('choose')}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          Back
        </button>
      </div>
    </div>
  );
}
