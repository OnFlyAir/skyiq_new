import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Lock, Eye, EyeOff, User, Plane } from 'lucide-react';

export default function SignUpPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [wantsDfy, setWantsDfy] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuthContext();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (wantsDfy && !companyName.trim()) { setError('Company name is required for DFY service'); return; }
    setLoading(true);

    const { data, error: signUpError } = await signUp(email, password, firstName, lastName);
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    // If DFY selected, store preference in user metadata for post-confirmation setup
    if (wantsDfy && data?.user) {
      // We'll create the DFY client record after email confirmation via a trigger or on first login
      // For now store the intent in localStorage so onboarding can pick it up
      localStorage.setItem('skyiq_dfy_signup', JSON.stringify({
        company_name: companyName.trim(),
        contact_name: `${firstName} ${lastName}`.trim(),
        contact_email: email,
      }));
    }

    // Sign out immediately so the unconfirmed session doesn't auto-login
    await supabase.auth.signOut();

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-skyiq-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="h-7 w-7 text-skyiq-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Check your email</h2>
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
          We've sent a confirmation link to <strong className="text-foreground">{email}</strong>.
          <br />Click the link to activate your account.
        </p>
        <Link to="/login" className="text-primary font-medium hover:underline text-sm">Back to sign in</Link>
      </div>
    );
  }

  const inputCls = "w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";

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

        {/* DFY Service Add-on */}
        <div className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${wantsDfy ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}`} onClick={() => setWantsDfy(!wantsDfy)}>
          <div className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${wantsDfy ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
              {wantsDfy && <span className="text-primary-foreground text-xs font-bold">✓</span>}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Done-For-You Fuel Planning</span>
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">+$25/trip</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your trip sheets and our team optimizes your fuel plan for you
              </p>
            </div>
          </div>
        </div>

        {wantsDfy && (
          <div>
            <label htmlFor="company-name" className="block text-sm font-medium text-foreground/80 mb-1.5">Company name</label>
            <div className="relative">
              <Plane className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input id="company-name" type="text" placeholder="Your aviation company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className={inputCls} />
            </div>
          </div>
        )}

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
