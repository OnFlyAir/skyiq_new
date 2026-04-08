import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

export default function OnboardingPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        <img src={skyiqLogo} alt="SkyIQ" className="w-20 h-20 object-contain mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to SkyIQ</h1>
        <p className="text-muted-foreground mb-8">
          Hi {profile?.first_name || 'there'}! You're all set. Let's start planning.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
