import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Trip } from '@/types/database';

export default function TripSummaryPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSummary(); }, [tripId]);

  async function loadSummary() {
    const { data } = await supabase.from('trips').select('*').eq('id', Number(tripId)).single();
    if (data) setTrip(data as unknown as Trip);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!trip) return <p className="text-muted-foreground">Trip not found.</p>;

  const details = trip.details as any;
  const itinerary = trip.itinerary_details as any;
  const legs = itinerary?.legs || [];
  const results = details?.legs || details?.results || [];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">Trip {trip.itinerary_num} Summary</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {trip.savings > 0 && (
          <span className="text-primary font-semibold">Estimated Savings: ${trip.savings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        )}
      </p>

      <div className="space-y-6">
        {legs.map((leg: any, i: number) => {
          const result = results[i];
          return (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <div className="bg-secondary px-4 py-2 text-sm font-medium text-foreground">
                Leg {i + 1}: {leg.departure_icao} → {leg.destination_icao}
              </div>
              <div className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fuel Burn</span>
                  <span className="text-foreground">{leg.fuel_burn} lbs</span>
                </div>
                {result && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fuel to Uplift</span>
                      <span className="font-bold text-primary">{result.fuel_to_uplift_gallons || result.uplift_gallons || '-'} gal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fuel Cost</span>
                      <span className="text-foreground">${(result.fuel_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Cost</span>
                      <span className="font-semibold text-foreground">${(result.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!details || Object.keys(details).length === 0 ? (
        <p className="mt-6 text-muted-foreground text-sm">No optimization results yet. Go to the fuel page to run optimization.</p>
      ) : null}

      <div className="flex flex-wrap gap-3 mt-6">
        <Link to={`/trips/${tripId}/email`} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          Send Email
        </Link>
        <Link to={`/trips/${tripId}/legs`} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          Edit Itinerary
        </Link>
        <Link to="/dashboard" className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
