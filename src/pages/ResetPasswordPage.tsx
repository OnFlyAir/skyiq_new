import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { Mail, ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuthContext();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) { setError(error.message); setLoading(false); } else { setSuccess(true); setLoading(false); }
  }

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
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
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
