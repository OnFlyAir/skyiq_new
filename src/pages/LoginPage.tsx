import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';

const DEV_EMAIL = 'dev@skyiq.test';
const DEV_PASSWORD = 'devpass123';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, profile, loading: authLoading, signIn, signUp } = useAuthContext();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && profile) {
      if (profile.operator_id) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [authLoading, user, profile, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // Navigation handled by the useEffect above when auth state updates
  }

  async function handleDevLogin() {
    setError('');
    setLoading(true);
    try {
      const { error: signInErr } = await signIn(DEV_EMAIL, DEV_PASSWORD);
      if (signInErr) {
        // Account doesn't exist yet, create it
        const { error: signUpErr } = await signUp(DEV_EMAIL, DEV_PASSWORD, 'Dev', 'User');
        if (signUpErr) {
          setError(signUpErr.message);
          setLoading(false);
          return;
        }
        // Wait for trigger to create profile
        await new Promise(r => setTimeout(r, 1000));
        const { error: retryErr } = await signIn(DEV_EMAIL, DEV_PASSWORD);
        if (retryErr) {
          setError(retryErr.message);
          setLoading(false);
          return;
        }
      }
      // Navigation handled by the useEffect above when auth state updates
    } catch (err: any) {
      setError(err.message || 'Auto-login failed');
      setLoading(false);
    }
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-skyiq-accent" />
      </div>
    );
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
          onClick={handleDevLogin}
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
