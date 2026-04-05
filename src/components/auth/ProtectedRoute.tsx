import { Navigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';

interface Props {
  children: React.ReactNode;
  requireRole?: string[];
}

export default function ProtectedRoute({ children, requireRole }: Props) {
  const { user, profile, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-skyiq-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user has no operator, send to onboarding (unless they're a super admin)
  if (profile && !profile.operator_id && profile.role !== 'super_admin') {
    return <Navigate to="/onboarding" replace />;
  }

  if (requireRole && profile && !requireRole.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
