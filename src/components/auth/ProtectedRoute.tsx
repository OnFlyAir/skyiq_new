import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useDemo } from '@/contexts/DemoContext';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  children: React.ReactNode;
  requireRole?: string[];
}

// Routes that stay accessible even when the user's account is disabled,
// so they can always get back to resubscribing or updating billing.
const ALWAYS_ALLOWED = ['/subscription', '/profile', '/login', '/signup', '/reset-password', '/onboarding'];

// Subscription statuses that grant app access.
const ACTIVE_STATUSES = new Set(['active', 'trial', 'trialing', 'past_due']);

export default function ProtectedRoute({ children, requireRole }: Props) {
  const { user, profile, loading } = useAuthContext();
  const { active: demoActive } = useDemo();
  const location = useLocation();
  const [subStatus, setSubStatus] = useState<string | null | undefined>(undefined);

  const exempt = profile?.role_name === 'Admin' || profile?.role_name === 'Dev';

  // Fetch the user's subscription status once the profile is loaded.
  useEffect(() => {
    if (!profile || exempt) {
      setSubStatus(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (!cancelled) setSubStatus(data?.status ?? null);
    })();
    return () => { cancelled = true; };
  }, [profile?.id, exempt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && profile && !requireRole.includes(profile.role_name)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Billing enforcement: auto-disabled accounts can only access billing/profile.
  const disabled = profile && profile.is_enabled === false;
  if (disabled && !exempt && !demoActive && !ALWAYS_ALLOWED.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/subscription?blocked=1" replace />;
  }

  // Paywall for brand-new users: no subscription yet → force onboarding.
  // Waits for subStatus to resolve (undefined = still loading).
  // Skip the paywall while a guided demo is running so the demo user can
  // freely move through /trips/new, /fleet, etc. without being kicked to
  // /onboarding (which would render a blank screen mid-demo).
  if (
    !exempt &&
    !demoActive &&
    profile &&
    subStatus === null &&
    !ALWAYS_ALLOWED.some((p) => location.pathname.startsWith(p))
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  // Also gate users whose sub exists but isn't in an access-granting state.
  if (
    !exempt &&
    !demoActive &&
    profile &&
    typeof subStatus === 'string' &&
    !ACTIVE_STATUSES.has(subStatus) &&
    !ALWAYS_ALLOWED.some((p) => location.pathname.startsWith(p))
  ) {
    return <Navigate to="/subscription?blocked=1" replace />;
  }

  return <>{children}</>;
}
