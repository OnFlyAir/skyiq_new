import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Trip, TripLeg, Aircraft } from '@/types/database';

export default function TripFuelPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [legs, setLegs] = useState<TripLeg[]>([]);
  const [fuelOnBoard, setFuelOnBoard] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { loadData(); }, [tripId]);

  async function loadData() {
    const { data: tripData } = await supabase.from('trips').select('*, aircraft(*)').eq('id', tripId!).single();
    if (tripData) { setTrip(tripData as any); setAircraft((tripData as any).aircraft); setFuelOnBoard(Number(tripData.current_fuel_on_board) || 0); }
    const { data: legData } = await supabase.from('trip_legs').select('*').eq('trip_id', tripId!).eq('is_active', true).order('leg_number');
    if (legData) setLegs(legData as unknown as TripLeg[]);
    setLoading(false);
  }

  function updateFuelBurn(legId: string, value: number) {
    setLegs((prev) => prev.map((l) => (l.id === legId ? { ...l, fuel_burn: value } : l)));
  }

  async function handleConfirm() {
    setConfirming(true);
    await supabase.from('trips').update({ current_fuel_on_board: fuelOnBoard, status: 'confirmed' }).eq('id', tripId!);
    for (const leg of legs) { await supabase.from('trip_legs').update({ fuel_burn: leg.fuel_burn }).eq('id', leg.id); }
    navigate(`/trips/${tripId}/summary`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">Plan a Trip</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Trip Details for flight on{' '}
        <span className="font-medium bg-secondary px-2 py-1 rounded text-foreground">
          {aircraft?.nickname || aircraft?.tail_number}
        </span>
      </p>

      <div className="mb-8">
        <h2 className="font-semibold text-foreground mb-2">
          Click to select an input starting fuel at origin for your trip
        </h2>
        <div>
          <label className="text-sm font-medium text-foreground/80 block mb-1">Current Fuel on Board Aircraft</label>
          <input type="number" value={fuelOnBoard || ''} onChange={(e) => setFuelOnBoard(Number(e.target.value))} className={inputCls} />
          {aircraft && (
            <p className="text-xs text-muted-foreground mt-1">
              Maximum fuel on board for first leg (after gallon rounding): {aircraft.max_fuel_capacity} lbs (tank capacity: {aircraft.max_fuel_capacity} lbs).
            </p>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="font-semibold text-foreground mb-1">
          Click to select an input fuel burn for each leg your trip
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Fuel Burn for flight</p>

        <div className="space-y-4">
          {legs.map((leg) => (
            <div key={leg.id} className="flex items-center gap-4">
              <div className="w-16 text-sm font-medium text-muted-foreground">Leg {leg.leg_number}:</div>
              <div className="w-16 text-sm text-muted-foreground">{leg.departure_icao}</div>
              <div className="w-16 text-sm text-muted-foreground">{leg.destination_icao}</div>
              <input type="number" value={leg.fuel_burn || ''} onChange={(e) => updateFuelBurn(leg.id, Number(e.target.value))} className={"flex-1 px-3 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"} />
              <span className="text-xs text-muted-foreground">Effective Weights</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleConfirm} disabled={confirming} className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all">
          {confirming ? 'Confirming...' : 'Confirm trip'}
        </button>
        <button onClick={() => navigate(`/trips/${tripId}/legs`)} className="px-6 py-3 border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition-colors">
          Return to previous page
        </button>
      </div>
    </div>
  );
}
