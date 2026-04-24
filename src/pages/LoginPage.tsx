import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useDemo } from '@/contexts/DemoContext';
import { Mail, Lock, Eye, EyeOff, Shield, PlayCircle, Sparkles } from 'lucide-react';

const DEMO_PENDING_KEY = 'skyiq_demo_pending_trip';

const DEV_EMAIL = 'dev@skyiq.test';
const DEV_PASSWORD = 'devpass123';
const ADMIN_EMAIL = 'admin@skyiq.net';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_PIN = '123456';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPinMode, setShowPinMode] = useState(false);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const { user, profile, loading: authLoading, signIn, signUp } = useAuthContext();
  const { startDemo } = useDemo();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user && profile) {
      if (localStorage.getItem(DEMO_PENDING_KEY) === 'true') {
        localStorage.removeItem(DEMO_PENDING_KEY);
        startDemo('trip');
        navigate('/trips/new', { replace: true });
        return;
      }
      if (profile.role_name === 'Admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [authLoading, user, profile, navigate, startDemo]);

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

  async function handlePinLogin() {
    setError('');
    setLoading(true);
    const enteredPin = pin.join('');
    if (enteredPin !== ADMIN_PIN) {
      setError('Invalid PIN');
      setLoading(false);
      return;
    }
    // Try to sign in as admin, if fails, create admin user
    try {
      const { error: signInErr } = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      if (signInErr) {
        const { error: signUpErr } = await signUp(ADMIN_EMAIL, ADMIN_PASSWORD, 'Admin', 'User');
        if (signUpErr) {
          setError(signUpErr.message);
          setLoading(false);
          return;
        }
        await new Promise(r => setTimeout(r, 1000));
        const { error: retryErr } = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
        if (retryErr) {
          setError(retryErr.message);
          setLoading(false);
          return;
        }
      }
    } catch (err: any) {
      setError(err.message || 'PIN login failed');
      setLoading(false);
    }
  }

  function handlePinChange(index: number, value: string) {
    if (value.length > 1) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }
  }

  async function handleTryDemo() {
    setError('');
    setLoading(true);
    localStorage.setItem(DEMO_PENDING_KEY, 'true');
    try {
      const { error: signInErr } = await signIn(DEV_EMAIL, DEV_PASSWORD);
      if (signInErr) {
        const { error: signUpErr } = await signUp(DEV_EMAIL, DEV_PASSWORD, 'Dev', 'User');
        if (signUpErr) {
          localStorage.removeItem(DEMO_PENDING_KEY);
          setError(signUpErr.message); setLoading(false); return;
        }
        await new Promise(r => setTimeout(r, 1000));
        const { error: retryErr } = await signIn(DEV_EMAIL, DEV_PASSWORD);
        if (retryErr) {
          localStorage.removeItem(DEMO_PENDING_KEY);
          setError(retryErr.message); setLoading(false); return;
        }
      }
    } catch (err: any) {
      localStorage.removeItem(DEMO_PENDING_KEY);
      setError(err.message || 'Demo launch failed');
      setLoading(false);
    }
  }
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (showPinMode) {
    return (
      <>
        <div className="text-center mb-8">
          <Shield className="h-10 w-10 mx-auto mb-3 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Admin Access</h2>
          <p className="text-sm text-muted-foreground mt-1">Enter 6-digit PIN</p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg flex items-center gap-2">
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-destructive" />
            {error}
          </div>
        )}

        <div className="flex justify-center gap-2 mb-6">
          {pin.map((digit, index) => (
            <input
              key={index}
              id={`pin-${index}`}
              type="password"
              maxLength={1}
              value={digit}
              onChange={(e) => handlePinChange(index, e.target.value)}
              className="w-12 h-14 text-center text-xl font-bold border border-border rounded-lg bg-secondary/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digit && index > 0) {
                  const prevInput = document.getElementById(`pin-${index - 1}`);
                  prevInput?.focus();
                }
                if (e.key === 'Enter') handlePinLogin();
              }}
            />
          ))}
        </div>

        <button
          type="button"
          disabled={loading || pin.join('').length !== 6}
          onClick={handlePinLogin}
          className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Verifying...
            </span>
          ) : 'Access Admin'}
        </button>

        <button
          type="button"
          onClick={() => setShowPinMode(false)}
          className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to regular login
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

      {/* Admin PIN access */}
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => setShowPinMode(true)}
          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mx-auto"
        >
          <Shield className="w-3 h-3" />
          Admin Access
        </button>
      </div>

      {/* Try the demo — public access */}
      <div className="mt-5 pt-5 border-t border-border">
        <button
          type="button"
          disabled={loading}
          onClick={handleTryDemo}
          className="w-full py-2.5 bg-primary/10 border border-primary/30 text-primary font-medium rounded-lg hover:bg-primary/15 disabled:opacity-50 transition-all text-sm active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <PlayCircle className="w-4 h-4" />
          {loading ? 'Loading demo…' : 'Try the Trip Planning Demo'}
        </button>
        <p className="mt-2 text-xs text-center text-muted-foreground">
          No signup needed — see how SkyIQ optimizes fuel in 60 seconds.
        </p>
      </div>

      {/* Sign up today for $1 — primary conversion CTA */}
      <div className="mt-4">
        <Link
          to="/signup?tour=1"
          className="w-full py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold rounded-lg hover:opacity-95 transition-all text-sm active:scale-[0.98] flex items-center justify-center gap-2 shadow-md shadow-primary/20"
        >
          <Sparkles className="w-4 h-4" />
          Sign up today for $1
        </Link>
        <p className="mt-2 text-xs text-center text-muted-foreground">
          $1 today · 4 weeks of access · cancel anytime
        </p>
      </div>

      <p className="mt-6 text-sm text-center text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="text-primary font-medium hover:underline">Sign in above</Link>
      </p>
    </>
  );
}
