import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plane, Settings, ChevronRight, TrendingUp } from 'lucide-react';

import type { Trip } from '@/types/database';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

export default function DashboardPage() {
  const { user, profile } = useAuthContext();
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) { loadDashboardData(); } else { setLoading(false); }
  }, [user]);

  async function loadDashboardData() {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('user_company', user!.id)
      .order('created_on', { ascending: false })
      .limit(10);

    if (data) setRecentTrips(data as unknown as Trip[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Walkthrough />

      <h1 className="text-xl font-semibold text-center text-foreground mb-8">
        {profile?.company || 'SkyIQ'}
      </h1>

      <div className="flex justify-center mb-12">
        <img src={skyiqLogo} alt="SkyIQ - Fly Smarter" className="w-40 h-40 object-contain drop-shadow-md" />
      </div>

      <div className="flex gap-4 justify-center mb-12">
        <Link to="/trips/new" className="flex-1 max-w-[200px] p-5 bg-card border border-border rounded-xl hover:border-primary transition-all text-left group">
          <Plane className="w-5 h-5 text-primary mb-2" />
          <h3 className="font-semibold text-foreground">Plan a trip</h3>
          <p className="text-xs text-muted-foreground mt-1">Fool-proof fuel planning</p>
        </Link>
        <Link to="/fleet" className="flex-1 max-w-[200px] p-5 bg-card border border-border rounded-xl hover:border-primary transition-all text-left group">
          <Settings className="w-5 h-5 text-primary mb-2" />
          <h3 className="font-semibold text-foreground">Manage Fleet</h3>
          <p className="text-xs text-muted-foreground mt-1">View/Edit aircraft, add tail#'s</p>
        </Link>
        <Link to="/savings" className="flex-1 max-w-[200px] p-5 bg-card border border-border rounded-xl hover:border-primary transition-all text-left group">
          <TrendingUp className="w-5 h-5 text-primary mb-2" />
          <h3 className="font-semibold text-foreground">Savings</h3>
          <p className="text-xs text-muted-foreground mt-1">Track fuel cost savings</p>
        </Link>
      </div>

      {recentTrips.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Previous Trips</h2>
          <div className="space-y-2">
            {recentTrips.map((trip) => (
              <Link key={trip.id} to={`/trips/${trip.id}/summary`} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary transition-colors">
                <div>
                  <p className="font-medium text-foreground">Trip {trip.itinerary_num || trip.id}</p>
                  <p className="text-sm text-muted-foreground">{new Date(trip.created_on).toLocaleDateString()}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No trips yet. Plan your first trip to get started!</p>
        </div>
      )}
    </div>
  );
}
