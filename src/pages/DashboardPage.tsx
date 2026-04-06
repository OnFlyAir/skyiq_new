import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plane, Settings, ChevronRight, TrendingUp, Fuel } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Trip, Operator } from '@/types/database';
import skyiqLogoDark from '@/assets/skyiq-logo-dark.png';

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
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Operator name */}
      <p className="text-sm font-medium text-center text-muted-foreground tracking-widest uppercase">
        {operator?.name || 'Welcome'}
      </p>

      {/* Hero logo area */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="absolute -inset-8 rounded-3xl bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 blur-2xl" />
          <img
            src={skyiqLogoDark}
            alt="SkyIQ Logo"
            className="relative w-48 h-48 object-contain drop-shadow-lg"
          />
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        <Link to="/trips/new" className="group">
          <Card className="h-full border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 group-hover:-translate-y-0.5">
            <CardContent className="p-5 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Plane className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Plan a Trip</h3>
                <p className="text-xs text-muted-foreground mt-1">Fuel-smart flight planning</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/fleet" className="group">
          <Card className="h-full border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 group-hover:-translate-y-0.5">
            <CardContent className="p-5 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Manage Fleet</h3>
                <p className="text-xs text-muted-foreground mt-1">Aircraft & tail numbers</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/savings" className="group">
          <Card className="h-full border-border hover:border-accent/50 hover:shadow-lg transition-all duration-300 group-hover:-translate-y-0.5">
            <CardContent className="p-5 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Savings</h3>
                <p className="text-xs text-muted-foreground mt-1">Track fuel cost savings</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/trips/new" className="group">
          <Card className="h-full border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 group-hover:-translate-y-0.5">
            <CardContent className="p-5 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Fuel className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Fuel Prices</h3>
                <p className="text-xs text-muted-foreground mt-1">Compare FBO pricing</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent trips */}
      {recentTrips.length > 0 ? (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Previous Trips
          </h2>
          <div className="space-y-2">
            {recentTrips.map((trip) => (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}/summary`}
                className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plane className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      Trip {trip.trip_number} — {trip.aircraft?.nickname || trip.aircraft?.tail_number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(trip.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Plane className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No trips yet. Plan your first trip to get started!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
