import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';

interface Props {
  children: React.ReactNode;
  requireRole?: string[];
}

// Routes that stay accessible even when the user's account is disabled,
// so they can always get back to resubscribing or updating billing.
const ALWAYS_ALLOWED = ['/subscription', '/profile', '/login', '/signup', '/reset-password'];

export default function ProtectedRoute({ children, requireRole }: Props) {
  const { user, profile, loading } = useAuthContext();
  const location = useLocation();

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
  // Admin / Dev are always allowed.
  const exempt = profile?.role_name === 'Admin' || profile?.role_name === 'Dev';
  const disabled = profile && profile.is_enabled === false;
  if (disabled && !exempt && !ALWAYS_ALLOWED.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/subscription?blocked=1" replace />;
  }

  return <>{children}</>;
}
