import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthContext } from '@/hooks/useAuthContext';
import { Mail, Lock, Eye, EyeOff, User, Plane, MailCheck } from 'lucide-react';

export default function SignUpPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const { signUp } = useAuthContext();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);

    const { data: signUpData, error: signUpError } = await signUp(email, password, firstName, lastName);
    if (signUpError) {
      // Supabase returns a clear error for already-registered emails when
      // email confirmation is off. Surface a friendly message.
      const msg = /already|registered|exists/i.test(signUpError.message)
        ? 'An account with this email already exists. Please sign in instead.'
        : signUpError.message;
      setError(msg);
      setLoading(false);
      return;
    }

    // Anti-enumeration fallback: when an account already exists AND email
    // confirmation is enabled, Supabase returns a "fake" user with an empty
    // `identities` array instead of an error. Detect that and route to login.
    const identities = signUpData?.user?.identities;
    if (signUpData?.user && Array.isArray(identities) && identities.length === 0) {
      setError('An account with this email already exists. Please sign in instead.');
      setLoading(false);
      return;
    }

    // Try to sign in immediately. If auto-confirm is on, this succeeds and we
    // continue to onboarding (where the $1 checkout lives). If email
    // confirmation is required, sign-in will fail with "Email not confirmed" —
    // in that case we show a "check your email" screen instead of looping.
    const { supabase } = await import('@/integrations/supabase/client');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      const isUnconfirmed = /confirm|verify|not.*confirmed/i.test(signInError.message);
      if (isUnconfirmed) {
        setVerifyEmail(email);
        setLoading(false);
        return;
      }
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Auto-confirmed: send the new user into onboarding so they hit the $1
    // checkout step before landing in the dashboard.
    navigate('/onboarding', { replace: true });
  }

  const inputCls = "w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";

  if (verifyEmail) {
    return (
      <>
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <MailCheck className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
          <p className="text-sm text-muted-foreground mt-2">
            We sent a verification link to
          </p>
          <p className="text-sm font-medium text-foreground mt-1">{verifyEmail}</p>
        </div>
        <div className="p-4 bg-secondary/50 border border-border rounded-lg text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Next step:</strong> Click the link in
            that email to verify your account.
          </p>
          <p>
            After verifying, sign in and we'll walk you through activating your
            account for <strong className="text-foreground">$1</strong>.
          </p>
          <p className="text-xs">
            Didn't get it? Check your spam folder, or wait a minute and try
            signing in — the link can take a moment to arrive.
          </p>
        </div>
        <Link
          to="/login"
          className="mt-6 w-full inline-flex items-center justify-center py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          Go to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
        <p className="text-sm text-muted-foreground mt-1">Get started with SkyIQ</p>
      </div>

      {error && (
        <div className="mb-5 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg flex items-center gap-2">
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-destructive" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-foreground/80 mb-1.5">First name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input id="firstName" type="text" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-foreground/80 mb-1.5">Last name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input id="lastName" type="text" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputCls} />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-foreground/80 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input id="signup-email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
          </div>
        </div>

        <div>
          <label htmlFor="signup-password" className="block text-sm font-medium text-foreground/80 mb-1.5">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input id="signup-password" type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg text-sm bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              {[
                { label: 'At least 8 characters', met: password.length >= 8 },
                { label: 'Contains a number', met: /\d/.test(password) },
                { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
                { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(password) },
              ].map((req) => (
                <div key={req.label} className="flex items-center gap-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors ${req.met ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                  <span className={`transition-colors ${req.met ? 'text-emerald-500' : 'text-muted-foreground'}`}>{req.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground/80 mb-1.5">Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input id="confirm-password" type={showPassword ? 'text' : 'password'} placeholder="Re-enter your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputCls} />
          </div>
        </div>

        {/* DFY add-on intentionally removed from initial signup —
            users can opt in later from the DFY tab inside the app. */}

        <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-[0.98] mt-1">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Creating account...
            </span>
          ) : 'Create account'}
        </button>
      </form>

      <p className="mt-8 text-sm text-center text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
      </p>
    </>
  );
}
