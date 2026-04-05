import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/lib/supabase';
import { Plane, Settings, ChevronRight } from 'lucide-react';
import type { Trip, Operator } from '@/types/database';

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
        .single(),
      supabase
        .from('trips')
        .select('*, aircraft(tail_number, nickname)')
        .eq('operator_id', profile!.operator_id!)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (operatorRes.data) setOperator(operatorRes.data);
    if (tripsRes.data) setRecentTrips(tripsRes.data as any);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-skyiq-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Operator name */}
      <h1 className="text-xl font-semibold text-center text-gray-900 mb-8">
        {operator?.name || 'skyIQ'}
      </h1>

      {/* Logo area */}
      <div className="flex justify-center mb-12">
        <div className="text-center">
          <div className="text-5xl font-bold text-skyiq-blue">skyIQ</div>
          <p className="text-gray-500 mt-1">Fly Smarter</p>
        </div>
      </div>

      {/* Action cards */}
      <div className="flex gap-4 justify-center mb-12">
        <Link
          to="/trips/new"
          className="flex-1 max-w-[200px] p-5 bg-white border border-gray-200 rounded-xl hover:border-skyiq-accent hover:shadow-sm transition-all text-left"
        >
          <Plane className="w-5 h-5 text-skyiq-accent mb-2" />
          <h3 className="font-semibold text-gray-900">Plan a trip</h3>
          <p className="text-xs text-gray-500 mt-1">Fool-proof fuel planning</p>
        </Link>

        <Link
          to="/fleet"
          className="flex-1 max-w-[200px] p-5 bg-white border border-gray-200 rounded-xl hover:border-skyiq-accent hover:shadow-sm transition-all text-left"
        >
          <Settings className="w-5 h-5 text-skyiq-accent mb-2" />
          <h3 className="font-semibold text-gray-900">Manage Fleet</h3>
          <p className="text-xs text-gray-500 mt-1">View/Edit aircraft, add tail#'s</p>
        </Link>
      </div>

      {/* Recent trips */}
      {recentTrips.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Previous Trips
          </h2>
          <div className="space-y-2">
            {recentTrips.map((trip) => (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}`}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-skyiq-accent transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    Trip {trip.trip_number} - {trip.aircraft?.nickname || trip.aircraft?.tail_number}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(trip.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
