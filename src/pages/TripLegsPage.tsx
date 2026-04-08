import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '@/lib/config';
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

function mapApiLegs(apiLegs: any[]): LegData[] {
  return apiLegs.map((leg) => {
    const fuelTiers = (leg.departure_fuel_price || []).map((t: any) => ({
      price_per_gallon: t.price || 0,
      min_quantity_gallons: t.min_fuel || 0,
    }));

    const fees = leg.fees || [];
    const totalFeeCost = fees.reduce((sum: number, f: any) => sum + (f.amount || 0), 0);
    const waivableFee = fees.find((f: any) => f.is_waivable);

    return {
      departure_icao: leg.departure || '',
      destination_icao: leg.destination || '',
      fuel_burn: leg.fuel_burn || 0,
      reserve: leg.reserve || 0,
      taxi_fuel_burn: 0,
      max_takeoff_weight: 0,
      max_landing_weight: 0,
      crew_weights: leg.crew_weight || [],
      passenger_weights: leg.passengers || [],
      baggage_weight: leg.baggage || 0,
      departure_fee_cost: totalFeeCost,
      departure_fee_waived_with: waivableFee?.waived_at || 0,
      fuel_price_tiers: fuelTiers.length > 0 ? fuelTiers : [{ price_per_gallon: 0, min_quantity_gallons: 0 }],
    } as LegData;
  });
}

export default function TripLegsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [legs, setLegs] = useState<LegData[]>([emptyLeg()]);
  const [fuelOnBoard, setFuelOnBoard] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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

  async function handleUpload(endpoint: string) {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch(`${API_URL}${endpoint}`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      const parsed = result.data;
      const mappedLegs = mapApiLegs(parsed.legs || []);
      setLegs(mappedLegs.length > 0 ? mappedLegs : [emptyLeg()]);
      setFuelOnBoard(parsed.starting_fuel || 0);

      if (parsed.itinerary_num && trip) {
        setTrip({ ...trip, itinerary_num: parsed.itinerary_num });
      }

      toast.success(`Parsed ${mappedLegs.length} leg${mappedLegs.length !== 1 ? 's' : ''} from trip sheet`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse trip sheet');
    } finally {
      setUploading(false);
    }
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

      {/* Upload OFP Section */}
      <div className="mb-6 p-5 bg-card border border-dashed border-border rounded-xl">
        <h3 className="font-semibold text-foreground mb-3">Upload Trip Sheet</h3>
        <p className="text-xs text-muted-foreground mb-3">Upload a PDF trip sheet / OFP to auto-fill leg data.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Upload className="w-4 h-4" />
            {selectedFile ? selectedFile.name : 'Choose PDF'}
          </button>
          <button
            onClick={() => handleUpload('/api/parse-itinerary')}
            disabled={!selectedFile || uploading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Parse
          </button>
        </div>
      </div>

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
