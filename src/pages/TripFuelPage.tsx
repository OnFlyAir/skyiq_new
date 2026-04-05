import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
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

  useEffect(() => {
    loadData();
  }, [tripId]);

  async function loadData() {
    const { data: tripData } = await supabase
      .from('trips')
      .select('*, aircraft(*)')
      .eq('id', tripId!)
      .single();

    if (tripData) {
      setTrip(tripData as any);
      setAircraft((tripData as any).aircraft);
      setFuelOnBoard(Number(tripData.current_fuel_on_board) || 0);
    }

    const { data: legData } = await supabase
      .from('trip_legs')
      .select('*')
      .eq('trip_id', tripId!)
      .eq('is_active', true)
      .order('leg_number');

    if (legData) setLegs(legData as TripLeg[]);
    setLoading(false);
  }

  function updateFuelBurn(legId: string, value: number) {
    setLegs((prev) =>
      prev.map((l) => (l.id === legId ? { ...l, fuel_burn: value } : l))
    );
  }

  async function handleConfirm() {
    setConfirming(true);

    // Save fuel on board
    await supabase
      .from('trips')
      .update({ current_fuel_on_board: fuelOnBoard, status: 'confirmed' })
      .eq('id', tripId!);

    // Save fuel burns
    for (const leg of legs) {
      await supabase
        .from('trip_legs')
        .update({ fuel_burn: leg.fuel_burn })
        .eq('id', leg.id);
    }

    // Navigate to trip summary (algorithm will populate results)
    navigate(`/trips/${tripId}/summary`);
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
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Plan a Trip</h1>
      <p className="text-sm text-gray-500 mb-6">
        Trip Details for flight on{' '}
        <span className="font-medium bg-gray-100 px-2 py-1 rounded">
          {aircraft?.nickname || aircraft?.tail_number}
        </span>
      </p>

      {/* Starting fuel */}
      <div className="mb-8">
        <h2 className="font-semibold text-gray-900 mb-2">
          Click to select an input starting fuel at origin for your trip
        </h2>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Current Fuel on Board Aircraft
          </label>
          <input
            type="number"
            value={fuelOnBoard || ''}
            onChange={(e) => setFuelOnBoard(Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-gray-100 rounded-lg text-sm"
          />
          {aircraft && (
            <p className="text-xs text-gray-400 mt-1">
              Maximum fuel on board for first leg (after gallon rounding): {aircraft.max_fuel_capacity} lbs (tank capacity: {aircraft.max_fuel_capacity} lbs).
            </p>
          )}
        </div>
      </div>

      {/* Per-leg fuel burn */}
      <div className="mb-8">
        <h2 className="font-semibold text-gray-900 mb-1">
          Click to select an input fuel burn for each leg your trip
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Fuel Burn for flight
        </p>

        <div className="space-y-4">
          {legs.map((leg) => (
            <div key={leg.id} className="flex items-center gap-4">
              <div className="w-16 text-sm font-medium text-gray-600">Leg {leg.leg_number}:</div>
              <div className="w-16 text-sm text-gray-500">{leg.departure_icao}</div>
              <div className="w-16 text-sm text-gray-500">{leg.destination_icao}</div>
              <input
                type="number"
                value={leg.fuel_burn || ''}
                onChange={(e) => updateFuelBurn(leg.id, Number(e.target.value))}
                className="flex-1 px-3 py-2.5 bg-gray-100 rounded-lg text-sm"
              />
              <span className="text-xs text-gray-400">Effective Weights</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="px-6 py-3 bg-skyiq-accent text-white font-medium rounded-lg hover:bg-skyiq-accent/90 disabled:opacity-50"
        >
          {confirming ? 'Confirming...' : 'Confirm trip'}
        </button>
        <button
          onClick={() => navigate(`/trips/${tripId}/legs`)}
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
        >
          Return to previous page
        </button>
      </div>
    </div>
  );
}
