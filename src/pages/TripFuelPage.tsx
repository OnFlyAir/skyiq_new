import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Trip } from '@/types/database';

export default function TripFuelPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => { loadData(); }, [tripId]);

  async function loadData() {
    const { data } = await supabase.from('trips').select('*').eq('id', Number(tripId)).single();
    if (data) setTrip(data as unknown as Trip);
    setLoading(false);
  }

  async function handleOptimize() {
    if (!trip) return;
    setOptimizing(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const response = await fetch(`${apiUrl}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trip.itinerary_details),
      });

      if (response.ok) {
        const result = await response.json();
        await supabase.from('trips').update({
          details: result as any,
          savings: result.savings || 0,
        } as any).eq('id', Number(tripId));
      }
    } catch (err) {
      console.error('Optimization failed:', err);
    }

    setOptimizing(false);
    navigate(`/trips/${tripId}/summary`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const itinerary = trip?.itinerary_details as any;
  const legs = itinerary?.legs || [];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">Confirm & Optimize</h1>
      <p className="text-sm text-muted-foreground mb-6">Trip {trip?.itinerary_num}</p>

      <div className="mb-6 p-4 bg-card border border-border rounded-xl">
        <p className="text-sm text-muted-foreground mb-1">Fuel on Board</p>
        <p className="text-lg font-semibold text-foreground">{itinerary?.fuel_on_board || 0} lbs</p>
      </div>

      <div className="space-y-3 mb-8">
        {legs.map((leg: any, i: number) => (
          <div key={i} className="p-4 bg-card border border-border rounded-lg">
            <p className="font-medium text-foreground">Leg {i + 1}: {leg.departure_icao} → {leg.destination_icao}</p>
            <p className="text-sm text-muted-foreground">Fuel Burn: {leg.fuel_burn} lbs • Reserve: {leg.reserve} lbs</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={handleOptimize} disabled={optimizing} className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all">
          {optimizing ? 'Optimizing...' : 'Run Optimization'}
        </button>
        <button onClick={() => navigate(`/trips/${tripId}/legs`)} className="px-6 py-3 border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition-colors">
          Back to Legs
        </button>
      </div>
    </div>
  );
}
