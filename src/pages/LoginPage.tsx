import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';

const DEV_EMAIL = 'dev@skyiq.test';
const DEV_PASSWORD = 'devpass123';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, refreshProfile } = useAuthContext();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">Welcome back</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-skyiq-accent focus:border-transparent"
          />
        </div>

        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-skyiq-accent focus:border-transparent"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded border-gray-300"
          />
          Remember me?
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-skyiq-accent text-white font-medium rounded-lg hover:bg-skyiq-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      {/* Dev auto-login */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setError('');
            setLoading(true);
            try {
              // Try sign in first, if fails sign up then sign in
              let { error: signInErr } = await signIn(DEV_EMAIL, DEV_PASSWORD);
              if (signInErr) {
                const { data: signUpData, error: signUpErr } = await signUp(DEV_EMAIL, DEV_PASSWORD, 'Dev', 'User');
                if (signUpErr) { setError(signUpErr.message); setLoading(false); return; }
                // Wait a moment for the profile trigger to fire
                await new Promise(r => setTimeout(r, 1000));
                const { error: retryErr } = await signIn(DEV_EMAIL, DEV_PASSWORD);
                if (retryErr) { setError(retryErr.message); setLoading(false); return; }
              }

              // Ensure dev user has an operator
              const { data: profile } = await supabase
                .from('profiles')
                .select('operator_id')
                .eq('email', DEV_EMAIL)
                .single();

              if (profile && !profile.operator_id) {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                if (currentUser) {
                  const { data: op } = await supabase
                    .from('operators')
                    .insert({ name: 'Dev Operator', created_by: currentUser.id })
                    .select()
                    .single();
                  if (op) {
                    await supabase
                      .from('profiles')
                      .update({ operator_id: op.id, role: 'operator_admin' })
                      .eq('id', currentUser.id);
                  }
                }
              }

              // Refresh profile in React state so ProtectedRoute sees the operator_id
              await refreshProfile();
              navigate('/dashboard');
            } catch (err: any) {
              setError(err.message || 'Auto-login failed');
              setLoading(false);
            }
          }}
          className="w-full py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm"
        >
          {loading ? 'Logging in...' : '⚡ Dev Auto-Login'}
        </button>
      </div>

      <div className="mt-6 space-y-2 text-sm text-center">
        <p>
          Don't have an account?{' '}
          <Link to="/signup" className="text-skyiq-accent hover:underline">Sign Up</Link>
        </p>
        <p>
          Forgot password?{' '}
          <Link to="/reset-password" className="text-skyiq-accent hover:underline">Reset</Link>
        </p>
      </div>
    </>
  );
}
