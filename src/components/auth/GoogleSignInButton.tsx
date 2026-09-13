import { useState } from 'react';
import { lovable } from '@/integrations/lovable/index';

interface Props {
  onError?: (message: string) => void;
}

export default function GoogleSignInButton({ onError }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        onError?.(result.error.message || 'Google sign-in failed');
        setLoading(false);
        return;
      }
      if (result.redirected) return; // browser is navigating to Google
      // Session already set — the auth listener will route the user.
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Google sign-in failed');
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleGoogle}
      disabled={loading}
      className="w-full py-2.5 border border-border bg-card text-foreground font-medium rounded-lg hover:bg-secondary/60 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 text-sm"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1a7.16 7.16 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
      </svg>
      {loading ? 'Connecting to Google…' : 'Continue with Google'}
    </button>
  );
}
