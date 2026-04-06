import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

const DEV_EMAIL = 'dev@skyiq.test';
const DEV_PASSWORD = 'devpass123';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
        <p className="text-sm text-gray-500 mt-1">Sign in to your SkyIQ account</p>
      </div>

      {error && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-skyiq-accent/40 focus:border-skyiq-accent focus:bg-white transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Link to="/reset-password" className="text-xs text-skyiq-accent hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-skyiq-accent/40 focus:border-skyiq-accent focus:bg-white transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded border-gray-300 text-skyiq-accent focus:ring-skyiq-accent/40"
          />
          Remember me
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-skyiq-accent text-white font-medium rounded-lg hover:bg-skyiq-accent/90 disabled:opacity-50 transition-all shadow-md shadow-skyiq-accent/25 hover:shadow-lg hover:shadow-skyiq-accent/30 active:scale-[0.98]"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Signing in...
            </span>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* Dev auto-login */}
      <div className="mt-5 pt-5 border-t border-gray-100">
        <button
          type="button"
          disabled={loading}
          onClick={handleDevLogin}
          className="w-full py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-all text-sm active:scale-[0.98]"
        >
          {loading ? 'Signing in...' : 'Dev Auto-Login'}
        </button>
      </div>

      <p className="mt-8 text-sm text-center text-gray-500">
        Don't have an account?{' '}
        <Link to="/signup" className="text-skyiq-accent font-medium hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
