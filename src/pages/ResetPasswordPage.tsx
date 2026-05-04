import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuthContext();
  const navigate = useNavigate();

  // Recovery mode (user clicked link in email)
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updated, setUpdated] = useState(false);

  // Detect recovery link. Supabase sends users here with a recovery token in
  // the URL hash (#access_token=...&type=recovery). The client auto-exchanges
  // it and fires a PASSWORD_RECOVERY auth event.
  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      setRecoveryMode(true);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) { setError(error.message); setLoading(false); }
    else { setSuccess(true); setLoading(false); }
  }

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setError(error.message); setLoading(false); return; }
    setUpdated(true);
    setLoading(false);
    // Sign out so the user logs in cleanly with the new password.
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    }, 2000);
  }

  const inputCls = "w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";

  // ---- Recovery flow: set new password ----
  if (recoveryMode) {
    if (updated) {
      return (
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Password updated</h2>
          <p className="text-muted-foreground text-sm">Redirecting you to sign in…</p>
        </div>
      );
    }
    return (
      <>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-foreground">Set a new password</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose a strong password you haven't used before.</p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg flex items-center gap-2">
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-destructive" />
            {error}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-foreground/80 mb-1.5">New password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg text-sm bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-new-password" className="block text-sm font-medium text-foreground/80 mb-1.5">Confirm password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="confirm-new-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={inputCls}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-[0.98]">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Updating…
              </span>
            ) : 'Update password'}
          </button>
        </form>
      </>
    );
  }

  // ---- Request reset email — success state ----
  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Check your email</h2>
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
          We've sent a password reset link to <strong className="text-foreground">{email}</strong>.
        </p>
        <Link to="/login" className="text-primary font-medium hover:underline text-sm">Back to sign in</Link>
      </div>
    );
  }

  // ---- Request reset email — form ----
  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">Reset your password</h2>
        <p className="text-sm text-muted-foreground mt-1">Enter your email and we'll send you a reset link</p>
      </div>

      {error && (
        <div className="mb-5 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg flex items-center gap-2">
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-destructive" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="reset-email" className="block text-sm font-medium text-foreground/80 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="reset-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputCls}
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-[0.98]">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Sending...
            </span>
          ) : 'Send reset link'}
        </button>
      </form>

      <p className="mt-8 text-center">
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </>
  );
}
