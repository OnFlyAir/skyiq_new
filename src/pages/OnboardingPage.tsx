import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

export default function OnboardingPage() {
  const { profile, user } = useAuthContext();
  const navigate = useNavigate();

  // Create DFY client record if user signed up with DFY option
  useEffect(() => {
    if (!user) return;
    const dfyData = localStorage.getItem('skyiq_dfy_signup');
    if (!dfyData) return;

    (async () => {
      try {
        const parsed = JSON.parse(dfyData);
        // Check if already created
        const { data: existing } = await supabase
          .from("dfy_clients" as any)
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("dfy_clients" as any).insert({
            user_id: user.id,
            company_name: parsed.company_name || "",
            contact_name: parsed.contact_name || "",
            contact_email: parsed.contact_email || "",
            pricing_tier: "per_trip",
          } as any);
        }
        localStorage.removeItem('skyiq_dfy_signup');
      } catch (err) {
        console.error("DFY client setup error:", err);
      }
    })();
  }, [user]);

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
