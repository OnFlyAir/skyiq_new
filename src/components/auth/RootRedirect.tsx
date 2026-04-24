import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Root path handler: always lands the user on /login.
 * If a cached session exists, sign it out first so the visitor sees the
 * marketing/login surface instead of being silently auto-forwarded into
 * the app. This matches the expectation that the public link opens the
 * login page.
 */
export default function RootRedirect() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await supabase.auth.signOut();
        }
      } catch {
        // ignore — we're navigating to /login regardless
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <Navigate to="/login" replace />;
}
