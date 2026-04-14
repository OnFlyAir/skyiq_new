import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { Mail, Lock, Eye, EyeOff, Shield } from 'lucide-react';

const DEV_EMAIL = 'dev@skyiq.test';
const DEV_PASSWORD = 'devpass123';
const ADMIN_PIN = '123456';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const { user, profile, loading: authLoading, signIn, signUp } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user && profile) {
      if (profile.role_name === 'Admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
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
  }

  async function handleDevLogin() {
    setError('');
    setLoading(true);
    try {
      const { error: signInErr } = await signIn(DEV_EMAIL, DEV_PASSWORD);
      if (signInErr) {
        const { error: signUpErr } = await signUp(DEV_EMAIL, DEV_PASSWORD, 'Dev', 'User');
        if (signUpErr) { setError(signUpErr.message); setLoading(false); return; }
        await new Promise(r => setTimeout(r, 1000));
        const { error: retryErr } = await signIn(DEV_EMAIL, DEV_PASSWORD);
        if (retryErr) { setError(retryErr.message); setLoading(false); return; }
      }
    } catch (err: any) {
      setError(err.message || 'Auto-login failed');
      setLoading(false);
    }
  }

  function handlePinSubmit(e: FormEvent) {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      navigate('/admin', { replace: true });
    } else {
      setPinError('Incorrect PIN');
      setPin('');
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (showPinEntry) {
    return (
      <>
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Admin Access</h2>
          <p className="text-sm text-muted-foreground mt-1">Enter the admin PIN to continue</p>
        </div>

        {pinError && (
          <div className="mb-5 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg flex items-center gap-2">
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-destructive" />
            {pinError}
          </div>
        )}

        <form onSubmit={handlePinSubmit} className="space-y-5">
          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-foreground/80 mb-1.5">PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              autoFocus
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-secondary/50 text-foreground text-center tracking-[0.5em] placeholder:tracking-[0.3em] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all active:scale-[0.98]"
          >
            Enter
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setShowPinEntry(false); setPin(''); setPinError(''); }}
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to login
        </button>
      </>
    );
  }

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
        <p className="text-sm text-muted-foreground mt-1">Sign in to your SkyIQ account</p>
      </div>

      {error && (
        <div className="mb-5 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg flex items-center gap-2">
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-destructive" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground/80 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-foreground/80">Password</label>
            <Link to="/reset-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg text-sm bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded border-border bg-secondary/50 text-primary focus:ring-primary/40"
          />
          Remember me
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Signing in...
            </span>
          ) : 'Sign in'}
        </button>
      </form>

      {/* Dev auto-login */}
      <div className="mt-5 pt-5 border-t border-border">
        <button
          type="button"
          disabled={loading}
          onClick={handleDevLogin}
          className="w-full py-2.5 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-secondary/80 disabled:opacity-50 transition-all text-sm active:scale-[0.98]"
        >
          {loading ? 'Signing in...' : 'Dev Auto-Login'}
        </button>
      </div>

      {/* Admin access */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowPinEntry(true)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
        >
          <Shield className="h-3.5 w-3.5" />
          Admin Access
        </button>
      </div>

      <p className="mt-8 text-sm text-center text-muted-foreground">
        Don't have an account?{' '}
        <Link to="/signup" className="text-primary font-medium hover:underline">Create one</Link>
      </p>
    </>
  );
}
