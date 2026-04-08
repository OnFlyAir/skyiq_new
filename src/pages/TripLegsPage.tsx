import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';
import type { Trip } from '@/types/database';

interface LegData {
  departure_icao: string;
  destination_icao: string;
  fuel_burn: number;
  reserve: number;
  taxi_fuel_burn: number;
  max_takeoff_weight: number;
  max_landing_weight: number;
  crew_weights: number[];
  passenger_weights: number[];
  baggage_weight: number;
  departure_fee_cost: number;
  departure_fee_waived_with: number;
  fuel_price_tiers: { price_per_gallon: number; min_quantity_gallons: number }[];
}

const emptyLeg = (): LegData => ({
  departure_icao: '',
  destination_icao: '',
  fuel_burn: 0,
  reserve: 0,
  taxi_fuel_burn: 0,
  max_takeoff_weight: 0,
  max_landing_weight: 0,
  crew_weights: [],
  passenger_weights: [],
  baggage_weight: 0,
  departure_fee_cost: 0,
  departure_fee_waived_with: 0,
  fuel_price_tiers: [{ price_per_gallon: 0, min_quantity_gallons: 0 }],
});

export default function TripLegsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [legs, setLegs] = useState<LegData[]>([emptyLeg()]);
  const [fuelOnBoard, setFuelOnBoard] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTrip(); }, [tripId]);

  async function loadTrip() {
    const { data } = await supabase.from('trips').select('*').eq('id', Number(tripId)).single();
    if (data) {
      const t = data as unknown as Trip;
      setTrip(t);
      if (t.itinerary_details && Array.isArray((t.itinerary_details as any).legs)) {
        setLegs((t.itinerary_details as any).legs);
        setFuelOnBoard((t.itinerary_details as any).fuel_on_board || 0);
      }
    }
    setLoading(false);
  }

  function updateLeg(index: number, field: string, value: any) {
    setLegs((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addLeg() {
    const last = legs[legs.length - 1];
    setLegs((prev) => [...prev, { ...emptyLeg(), departure_icao: last?.destination_icao || '' }]);
  }

  function updateFuelTier(legIndex: number, tierIndex: number, field: string, value: number) {
    setLegs((prev) => prev.map((l, i) => {
      if (i !== legIndex) return l;
      const tiers = [...l.fuel_price_tiers];
      tiers[tierIndex] = { ...tiers[tierIndex], [field]: value };
      return { ...l, fuel_price_tiers: tiers };
    }));
  }

  function addFuelTier(legIndex: number) {
    setLegs((prev) => prev.map((l, i) => i !== legIndex ? l : { ...l, fuel_price_tiers: [...l.fuel_price_tiers, { price_per_gallon: 0, min_quantity_gallons: 0 }] }));
  }

  async function handleNext() {
    // Save legs into the trip's itinerary_details
    await supabase.from('trips').update({
      itinerary_details: { legs, fuel_on_board: fuelOnBoard } as any,
    } as any).eq('id', Number(tripId));
    navigate(`/trips/${tripId}/fuel`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all";

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">Trip Legs</h1>
      <p className="text-sm text-muted-foreground mb-6">Trip {trip?.itinerary_num}</p>

      <div className="mb-6">
        <label className="text-sm font-medium text-foreground/80 block mb-1">Current Fuel on Board (lbs.)</label>
        <input type="number" value={fuelOnBoard || ''} onChange={(e) => setFuelOnBoard(Number(e.target.value))} className={inputCls} />
      </div>

      {legs.map((leg, idx) => (
        <div key={idx} className="mb-8 p-5 bg-card border border-border rounded-xl">
          <h3 className="font-semibold text-foreground mb-4">Leg {idx + 1}</h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">Departure</label>
                <input value={leg.departure_icao} onChange={(e) => updateLeg(idx, 'departure_icao', e.target.value.toUpperCase())} placeholder="ICAO" className={inputCls} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">Destination</label>
                <input value={leg.destination_icao} onChange={(e) => updateLeg(idx, 'destination_icao', e.target.value.toUpperCase())} placeholder="ICAO" className={inputCls} />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">Fee Cost (USD)</label>
                <input type="number" value={leg.departure_fee_cost || ''} onChange={(e) => updateLeg(idx, 'departure_fee_cost', Number(e.target.value))} className={inputCls} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">Waived With (gal)</label>
                <input type="number" value={leg.departure_fee_waived_with || ''} onChange={(e) => updateLeg(idx, 'departure_fee_waived_with', Number(e.target.value))} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Crew Weights (comma-separated)</label>
              <input value={leg.crew_weights?.join(', ') || ''} onChange={(e) => updateLeg(idx, 'crew_weights', e.target.value.split(',').map(Number).filter(Boolean))} className={inputCls} placeholder="180, 230" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Passenger Weights (comma-separated)</label>
              <input value={leg.passenger_weights?.join(', ') || ''} onChange={(e) => updateLeg(idx, 'passenger_weights', e.target.value.split(',').map(Number).filter(Boolean))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Baggage (lbs.)</label>
              <input type="number" value={leg.baggage_weight || ''} onChange={(e) => updateLeg(idx, 'baggage_weight', Number(e.target.value))} className={inputCls} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Fuel Prices</label>
              {leg.fuel_price_tiers.map((tier, ti) => (
                <div key={ti} className="flex gap-3 mb-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">$/gal</label>
                    <input type="number" step="0.01" value={tier.price_per_gallon || ''} onChange={(e) => updateFuelTier(idx, ti, 'price_per_gallon', Number(e.target.value))} className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Min qty (gal)</label>
                    <input type="number" value={tier.min_quantity_gallons || ''} onChange={(e) => updateFuelTier(idx, ti, 'min_quantity_gallons', Number(e.target.value))} className={inputCls} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => addFuelTier(idx)} className="text-xs px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                Add price tier
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Reserve (lbs.)</label>
                <input type="number" value={leg.reserve || ''} onChange={(e) => updateLeg(idx, 'reserve', Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Taxi Fuel Burn (lbs.)</label>
                <input type="number" value={leg.taxi_fuel_burn || ''} onChange={(e) => updateLeg(idx, 'taxi_fuel_burn', Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Max Takeoff Weight (lbs.)</label>
                <input type="number" value={leg.max_takeoff_weight || ''} onChange={(e) => updateLeg(idx, 'max_takeoff_weight', Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Max Landing Weight (lbs.)</label>
                <input type="number" value={leg.max_landing_weight || ''} onChange={(e) => updateLeg(idx, 'max_landing_weight', Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Fuel Burn (lbs.)</label>
                <input type="number" value={leg.fuel_burn || ''} onChange={(e) => updateLeg(idx, 'fuel_burn', Number(e.target.value))} className={inputCls} />
              </div>
            </div>
          </div>
        </div>
      ))}

      <button onClick={addLeg} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground mb-6 transition-colors">
        <Plus className="w-4 h-4" /> Add Leg
      </button>

      <button onClick={handleNext} className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all">
        Next — Confirm & Optimize
      </button>
    </div>
  );
}
