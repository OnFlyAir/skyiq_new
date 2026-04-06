import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Trip, TripLeg, TripLegResult, Aircraft } from '@/types/database';

interface LegWithResult extends TripLeg {
  result: TripLegResult | null;
}

export default function TripSummaryPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [legs, setLegs] = useState<LegWithResult[]>([]);
  const [viewMode, setViewMode] = useState<'full' | 'quick'>('full');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSummary(); }, [tripId]);

  async function loadSummary() {
    const { data: tripData } = await supabase.from('trips').select('*, aircraft(*)').eq('id', tripId!).single();
    if (tripData) { setTrip(tripData as any); setAircraft((tripData as any).aircraft); }
    const { data: legData } = await supabase.from('trip_legs').select('*, trip_leg_results(*)').eq('trip_id', tripId!).eq('is_active', true).order('leg_number');
    if (legData) { setLegs(legData.map((l: any) => ({ ...l, result: l.trip_leg_results?.[0] || null }))); }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const totalCost = legs.reduce((sum, l) => sum + (l.result?.total_cost || 0), 0);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">
        Trip {trip?.trip_number} Summary
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {viewMode === 'full' ? 'Fuel Plan Summary' : 'Quick Ref Fuel Plan'} for flight on{' '}
        {aircraft?.nickname || aircraft?.tail_number}
      </p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode('full')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            viewMode === 'full' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Full Summary
        </button>
        <button
          onClick={() => setViewMode('quick')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            viewMode === 'quick' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Quick Ref
        </button>
      </div>

      <div className="space-y-6">
        {legs.map((leg) => (
          <div key={leg.id} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-secondary px-4 py-2 text-sm font-medium text-foreground">
              {viewMode === 'full' ? `Leg ${leg.leg_number}: ` : ''}{leg.departure_icao} → {leg.destination_icao}
            </div>

            <table className="w-full text-sm">
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-4 py-2 font-semibold text-foreground">
                    {viewMode === 'full' ? 'Fuel to Uplift (gal., lbs.)' : 'Uplift (gal., lbs.)'}
                  </td>
                  <td className="px-4 py-2 font-bold text-primary">
                    {leg.result ? `${leg.result.fuel_to_uplift_gallons} gal., ${leg.result.fuel_to_uplift_lbs} lbs.` : 'Awaiting algorithm'}
                  </td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">Starting Fuel (lbs.)</td>
                  <td className="px-4 py-2 text-foreground">{leg.result?.starting_fuel_lbs ?? '-'} lbs.</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">Fuel Burn</td>
                  <td className="px-4 py-2 text-foreground">{leg.fuel_burn} lbs.</td>
                </tr>

                {viewMode === 'full' && (
                  <>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2 text-muted-foreground">Landing Fuel (lbs.)</td>
                      <td className="px-4 py-2 text-foreground">{leg.result?.landing_fuel_lbs ?? '-'} lbs.</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2 text-muted-foreground">Takeoff Weight (lbs.)</td>
                      <td className="px-4 py-2 text-foreground">{leg.result?.takeoff_weight_lbs ?? '-'} lbs.</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2 text-muted-foreground">Landing Weight (lbs.)</td>
                      <td className="px-4 py-2 text-foreground">{leg.result?.landing_weight_lbs ?? '-'} lbs.</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-4 py-2 text-muted-foreground">Fuel Cost ($)</td>
                      <td className="px-4 py-2 text-foreground">
                        {leg.result ? `$${leg.result.fuel_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                    </tr>
                  </>
                )}

                <tr className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">Waived Fees (y/n)</td>
                  <td className="px-4 py-2 text-foreground">{leg.result?.waived_fees ?? '-'}</td>
                </tr>

                {viewMode === 'full' && (
                  <tr className="border-t border-border">
                    <td className="px-4 py-2 font-semibold text-foreground">Total Cost ($)</td>
                    <td className="px-4 py-2 font-semibold text-foreground">
                      {leg.result ? `$${leg.result.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {viewMode === 'full' && totalCost > 0 && (
        <p className="text-lg font-bold text-foreground mt-6">
          Total Cost: ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      )}

      <div className="flex flex-wrap gap-3 mt-6">
        {viewMode === 'quick' && (
          <button onClick={() => setViewMode('full')} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            Full Plan Summary for flight on {aircraft?.nickname || aircraft?.tail_number}
          </button>
        )}
        {viewMode === 'full' && (
          <>
            <button onClick={() => setViewMode('quick')} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              Quick Ref Fuel Plan for flight on {aircraft?.nickname || aircraft?.tail_number}
            </button>
            <Link to={`/trips/${tripId}/email`} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              Send Email
            </Link>
          </>
        )}
        <Link to={`/trips/${tripId}/legs`} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          Edit Itinerary
        </Link>
      </div>
    </div>
  );
}
