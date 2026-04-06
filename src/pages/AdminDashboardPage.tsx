import { useEffect, useState } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';

interface OperatorStats {
  id: string;
  name: string;
  trips_count: number;
  savings: number;
  last_trip_date: string | null;
  tail_count: number;
}

export default function AdminDashboardPage() {
  const { profile } = useAuthContext();
  const [stats, setStats] = useState<OperatorStats[]>([]);
  const [search, setSearch] = useState('');
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);
  const [totalTails, setTotalTails] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [profile]);

  async function loadStats() {
    const [opsRes, tripsRes, aircraftRes] = await Promise.all([
      supabase.from('operators').select('*').order('name'),
      supabase.from('trips').select('operator_id, total_savings, created_at'),
      supabase.from('aircraft').select('operator_id'),
    ]);

    const operators = opsRes.data || [];
    const trips = tripsRes.data || [];
    const aircraftData = aircraftRes.data || [];

    const operatorStats: OperatorStats[] = operators.map((op: any) => {
      const opTrips = trips.filter((t: any) => t.operator_id === op.id);
      const opAircraft = aircraftData.filter((a: any) => a.operator_id === op.id);
      const savings = opTrips.reduce((sum: number, t: any) => sum + Number(t.total_savings || 0), 0);
      const lastTrip = opTrips.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      return {
        id: op.id,
        name: op.name,
        trips_count: opTrips.length,
        savings,
        last_trip_date: lastTrip?.created_at || null,
        tail_count: opAircraft.length,
      };
    });

    setStats(operatorStats);
    setTotalSavings(operatorStats.reduce((s, o) => s + o.savings, 0));
    setTotalTrips(trips.length);
    setTotalTails(aircraftData.length);
    setLoading(false);
  }

  const filtered = stats.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-skyiq-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Platform Overview</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">{totalSavings.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Est. Savings</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">{totalTrips}</p>
          <p className="text-sm text-gray-500">Trips Run</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-gray-900">{totalTails}</p>
          <p className="text-sm text-gray-500">Tails</p>
        </div>
      </div>

      {/* Search */}
      <h2 className="text-lg font-bold text-gray-900 mb-3">Trips/Tails</h2>
      <input
        type="text"
        placeholder="Search Company or Tail Number"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm mb-4"
      />

      {/* Operator list */}
      <div className="space-y-3">
        {filtered.map((op) => (
          <div key={op.id} className="p-4 bg-white border border-gray-200 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{op.name}</h3>
            <div className="flex gap-8 text-sm">
              <div>
                <p className="text-gray-500">Trips (All Time)</p>
                <p className="font-semibold">{op.trips_count}</p>
              </div>
              <div>
                <p className="text-gray-500">Estimated Savings</p>
                <p className="font-semibold">{op.savings.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Last Trip Ran</p>
                <p className="font-semibold">
                  {op.last_trip_date
                    ? new Date(op.last_trip_date).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
