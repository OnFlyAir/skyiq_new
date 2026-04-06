import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Check, X } from 'lucide-react';
import type { TripLeg, Trip, Aircraft, FuelPriceTier } from '@/types/database';

export default function TripLegsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [legs, setLegs] = useState<TripLeg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTripData();
  }, [tripId]);

  async function loadTripData() {
    const { data: tripData } = await supabase
      .from('trips')
      .select('*, aircraft(*)')
      .eq('id', tripId!)
      .single();

    if (tripData) {
      setTrip(tripData as any);
      setAircraft((tripData as any).aircraft);
    }

    const { data: legData } = await supabase
      .from('trip_legs')
      .select('*')
      .eq('trip_id', tripId!)
      .order('leg_number');

    if (legData) setLegs(legData as unknown as TripLeg[]);
    setLoading(false);
  }

  async function updateLeg(legId: string, field: string, value: any) {
    setLegs((prev) =>
      prev.map((l) => (l.id === legId ? { ...l, [field]: value } : l))
    );
  }

  async function saveLeg(leg: TripLeg) {
    const { id, created_at, updated_at, ...rest } = leg;
    await supabase.from('trip_legs').update(rest).eq('id', id);
  }

  async function addLeg() {
    const nextNum = legs.length + 1;
    const lastLeg = legs[legs.length - 1];

    const { data } = await supabase
      .from('trip_legs')
      .insert({
        trip_id: tripId!,
        leg_number: nextNum,
        departure_icao: lastLeg?.destination_icao || '',
        destination_icao: '',
        fuel_price_tiers: JSON.stringify([{ price_per_gallon: 0, min_quantity_gallons: 0 }]),
        reserve: aircraft?.preferred_reserve || 0,
        taxi_fuel_burn: aircraft?.taxi_fuel_burn || 0,
        max_takeoff_weight: aircraft?.max_takeoff_weight || 0,
        max_landing_weight: aircraft?.max_landing_weight || 0,
      } as any)
      .select()
      .single();

    if (data) setLegs((prev) => [...prev, data as unknown as TripLeg]);
  }

  async function toggleLeg(legId: string, active: boolean) {
    await supabase.from('trip_legs').update({ is_active: active }).eq('id', legId);
    setLegs((prev) => prev.map((l) => (l.id === legId ? { ...l, is_active: active } : l)));
  }

  function addFuelTier(legId: string) {
    setLegs((prev) =>
      prev.map((l) => {
        if (l.id !== legId) return l;
        return {
          ...l,
          fuel_price_tiers: [...l.fuel_price_tiers, { price_per_gallon: 0, min_quantity_gallons: 0 }],
        };
      })
    );
  }

  function removeFuelTier(legId: string) {
    setLegs((prev) =>
      prev.map((l) => {
        if (l.id !== legId || l.fuel_price_tiers.length <= 1) return l;
        return {
          ...l,
          fuel_price_tiers: l.fuel_price_tiers.slice(0, -1),
        };
      })
    );
  }

  function updateFuelTier(legId: string, index: number, field: keyof FuelPriceTier, value: number) {
    setLegs((prev) =>
      prev.map((l) => {
        if (l.id !== legId) return l;
        const tiers = [...l.fuel_price_tiers];
        tiers[index] = { ...tiers[index], [field]: value };
        return { ...l, fuel_price_tiers: tiers };
      })
    );
  }

  async function handleNext() {
    // Save all legs
    for (const leg of legs) {
      await saveLeg(leg);
    }
    navigate(`/trips/${tripId}/fuel`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-skyiq-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Plan a Trip</h1>
      <p className="text-sm text-gray-500 mb-6">
        Trip Details for flight on{' '}
        <span className="font-medium bg-gray-100 px-2 py-1 rounded">
          {aircraft?.nickname || aircraft?.tail_number}
        </span>
      </p>

      {legs.map((leg) => (
        <div
          key={leg.id}
          className={`mb-8 p-5 bg-white border rounded-xl ${
            leg.is_active ? 'border-gray-200' : 'border-red-200 opacity-60'
          }`}
        >
          <h3 className="font-semibold text-gray-900 mb-4">Leg {leg.leg_number}:</h3>

          <div className="space-y-3">
            {/* Departure / Destination */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">Departure</label>
                <input
                  value={leg.departure_icao}
                  onChange={(e) => updateLeg(leg.id, 'departure_icao', e.target.value.toUpperCase())}
                  placeholder="ICAO"
                  className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">Destination</label>
                <input
                  value={leg.destination_icao}
                  onChange={(e) => updateLeg(leg.id, 'destination_icao', e.target.value.toUpperCase())}
                  placeholder="ICAO"
                  className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Airport fee */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">Fee Cost (USD)</label>
                <input
                  type="number"
                  value={leg.departure_fee_cost || ''}
                  onChange={(e) => updateLeg(leg.id, 'departure_fee_cost', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                  placeholder="$ 0.00"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">Waived With</label>
                <input
                  type="number"
                  value={leg.departure_fee_waived_with || ''}
                  onChange={(e) => updateLeg(leg.id, 'departure_fee_waived_with', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Crew / PAX / Baggage */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Crew Weights (lbs.) comma-separated</label>
              <input
                value={leg.crew_weights?.join(', ') || ''}
                onChange={(e) => updateLeg(leg.id, 'crew_weights', e.target.value.split(',').map(Number).filter(Boolean))}
                className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                placeholder="180, 230"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Passenger Weights (lbs.) comma-separated</label>
              <input
                value={leg.passenger_weights?.join(', ') || ''}
                onChange={(e) => updateLeg(leg.id, 'passenger_weights', e.target.value.split(',').map(Number).filter(Boolean))}
                className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                placeholder="x,x,x"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Baggage</label>
              <input
                type="number"
                value={leg.baggage_weight || ''}
                onChange={(e) => updateLeg(leg.id, 'baggage_weight', Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
              />
            </div>

            {/* Fuel price tiers */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Departure Fuel Prices</label>
              {leg.fuel_price_tiers.map((tier, i) => (
                <div key={i} className="flex gap-3 mb-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">Price Per Gallon ($USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tier.price_per_gallon || ''}
                      onChange={(e) => updateFuelTier(leg.id, i, 'price_per_gallon', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400">Min Quantity per Rate (gal)</label>
                    <input
                      type="number"
                      value={tier.min_quantity_gallons || ''}
                      onChange={(e) => updateFuelTier(leg.id, i, 'min_quantity_gallons', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => addFuelTier(leg.id)}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Add fuel price option
                </button>
                <button
                  type="button"
                  onClick={() => removeFuelTier(leg.id)}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Remove fuel price option
                </button>
              </div>
            </div>

            {/* Reserve / Taxi / Weights */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Reserve</label>
                <input
                  type="number"
                  value={leg.reserve || ''}
                  onChange={(e) => updateLeg(leg.id, 'reserve', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Taxi Fuel Burn (lbs.)</label>
                <input
                  type="number"
                  value={leg.taxi_fuel_burn || ''}
                  onChange={(e) => updateLeg(leg.id, 'taxi_fuel_burn', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Max Takeoff Weight (lbs.)</label>
                <input
                  type="number"
                  value={leg.max_takeoff_weight || ''}
                  onChange={(e) => updateLeg(leg.id, 'max_takeoff_weight', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Max Landing Weight (lbs.)</label>
                <input
                  type="number"
                  value={leg.max_landing_weight || ''}
                  onChange={(e) => updateLeg(leg.id, 'max_landing_weight', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Be Sure to Adjust Max Takeoff & Max Landing weights to ensure sufficient Runway.
            </p>
          </div>

          {/* Leg actions */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t">
            <button
              onClick={() => { saveLeg(leg); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg border-2 ${
                leg.is_active
                  ? 'border-green-500 text-green-700 bg-green-50'
                  : 'border-gray-300 text-gray-600'
              }`}
            >
              <Check className="w-4 h-4 inline mr-1" />
              Yes
            </button>
            <button
              onClick={() => toggleLeg(leg.id, !leg.is_active)}
              className="px-4 py-2 text-sm font-medium rounded-lg border-2 border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <X className="w-4 h-4 inline mr-1" />
              Leg Not Needed
            </button>
          </div>
        </div>
      ))}

      {/* Add Leg */}
      <button
        onClick={addLeg}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 mb-6"
      >
        <Plus className="w-4 h-4" /> Add Leg
      </button>

      {/* Next */}
      <div className="flex gap-3">
        <button
          onClick={handleNext}
          className="px-6 py-3 bg-skyiq-accent text-white font-medium rounded-lg hover:bg-skyiq-accent/90"
        >
          Next — Starting fuel and fuel burns
        </button>
      </div>
    </div>
  );
}
