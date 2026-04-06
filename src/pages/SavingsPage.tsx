import { useEffect, useState } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plane } from 'lucide-react';

interface AircraftSavings {
  aircraft_id: string;
  nickname: string | null;
  tail_number: string;
  total_savings: number;
  trip_count: number;
}

export default function SavingsPage() {
  const { profile } = useAuthContext();
  const [savings, setSavings] = useState<AircraftSavings[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.operator_id) { loadSavings(); } else { setLoading(false); }
  }, [profile]);

  async function loadSavings() {
    const { data: trips } = await supabase
      .from('trips')
      .select('total_savings, aircraft(id, tail_number, nickname)')
      .eq('operator_id', profile!.operator_id!)
      .not('total_savings', 'is', null);

    if (trips) {
      const byAircraft: Record<string, AircraftSavings> = {};
      let total = 0;
      for (const trip of trips as any[]) {
        const ac = trip.aircraft;
        if (!byAircraft[ac.id]) {
          byAircraft[ac.id] = { aircraft_id: ac.id, nickname: ac.nickname, tail_number: ac.tail_number, total_savings: 0, trip_count: 0 };
        }
        byAircraft[ac.id].total_savings += Number(trip.total_savings || 0);
        byAircraft[ac.id].trip_count += 1;
        total += Number(trip.total_savings || 0);
      }
      setSavings(Object.values(byAircraft));
      setTotalSavings(total);
      setTotalTrips(trips.length);
    }
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
      <h1 className="text-2xl font-bold text-foreground mb-2">Potential Savings Earned</h1>
      <p className="text-sm text-muted-foreground italic mb-8">
        We show half the difference between your optimized fuel plan and a typical worst-case — giving you a realistic view of your likely savings.
      </p>

      <div className="flex gap-8 mb-8">
        <div className="p-4 bg-card border border-border rounded-xl flex-1">
          <p className="text-sm text-muted-foreground">Total Savings</p>
          <p className="text-2xl font-bold text-skyiq-success">${totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl flex-1">
          <p className="text-sm text-muted-foreground">Fuel Plans Calculated</p>
          <p className="text-2xl font-bold text-foreground">{totalTrips}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {savings.map((s) => (
          <div key={s.aircraft_id} className="flex flex-col items-center p-6 bg-card border border-border rounded-xl">
            <Plane className="w-20 h-20 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">{s.nickname || s.tail_number}</p>
            <p className="text-lg font-bold text-skyiq-success">${s.total_savings.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {savings.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No trips calculated yet. Plan a trip to see your savings!</p>
      )}
    </div>
  );
}
