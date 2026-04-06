import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plane, Settings, ChevronRight, TrendingUp } from 'lucide-react';
import Walkthrough from '@/components/Walkthrough';
import type { Trip, Operator } from '@/types/database';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

export default function DashboardPage() {
  const { profile } = useAuthContext();
  const [operator, setOperator] = useState<Operator | null>(null);
  const [recentTrips, setRecentTrips] = useState<(Trip & { aircraft: { tail_number: string; nickname: string | null } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.operator_id) {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [profile]);

  async function loadDashboardData() {
    const [operatorRes, tripsRes] = await Promise.all([
      supabase
        .from('operators')
        .select('*')
        .eq('id', profile!.operator_id!)
        .maybeSingle(),
      supabase
        .from('trips')
        .select('*, aircraft(tail_number, nickname)')
        .eq('operator_id', profile!.operator_id!)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (operatorRes.data) setOperator(operatorRes.data as any);
    if (tripsRes.data) setRecentTrips(tripsRes.data as any);
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

      {/* Operator name */}
      <h1 className="text-xl font-semibold text-center text-foreground mb-8">
        {operator?.name || 'SkyIQ'}
      </h1>

      {/* Logo area */}
      <div className="flex justify-center mb-12">
        <img src={skyiqLogo} alt="SkyIQ - Fly Smarter" className="w-40 h-40 object-contain drop-shadow-md" />
      </div>

      {/* Action cards */}
      <div className="flex gap-4 justify-center mb-12">
        <Link
          to="/trips/new"
          className="flex-1 max-w-[200px] p-5 bg-card border border-border rounded-xl hover:border-primary transition-all text-left group"
        >
          <Plane className="w-5 h-5 text-primary mb-2" />
          <h3 className="font-semibold text-foreground">Plan a trip</h3>
          <p className="text-xs text-muted-foreground mt-1">Fool-proof fuel planning</p>
        </Link>

        <Link
          to="/fleet"
          className="flex-1 max-w-[200px] p-5 bg-card border border-border rounded-xl hover:border-primary transition-all text-left group"
        >
          <Settings className="w-5 h-5 text-primary mb-2" />
          <h3 className="font-semibold text-foreground">Manage Fleet</h3>
          <p className="text-xs text-muted-foreground mt-1">View/Edit aircraft, add tail#'s</p>
        </Link>

        <Link
          to="/savings"
          className="flex-1 max-w-[200px] p-5 bg-card border border-border rounded-xl hover:border-primary transition-all text-left group"
        >
          <TrendingUp className="w-5 h-5 text-primary mb-2" />
          <h3 className="font-semibold text-foreground">Savings</h3>
          <p className="text-xs text-muted-foreground mt-1">Track fuel cost savings</p>
        </Link>
      </div>

      {/* Recent trips */}
      {recentTrips.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Previous Trips
          </h2>
          <div className="space-y-2">
            {recentTrips.map((trip) => (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}/summary`}
                className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary transition-colors"
              >
                <div>
                  <p className="font-medium text-foreground">
                    Trip {trip.trip_number} - {trip.aircraft?.nickname || trip.aircraft?.tail_number}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(trip.created_at).toLocaleDateString()}
                  </p>
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
