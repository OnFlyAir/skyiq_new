import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Plus } from 'lucide-react';
import type { Aircraft } from '@/types/database';

export default function NewTripPage() {
  const { profile, user } = useAuthContext();
  const navigate = useNavigate();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<string>('');
  const [tripNumber, setTripNumber] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.operator_id) { loadAircraft(); } else { setLoading(false); }
  }, [profile]);

  async function loadAircraft() {
    const { data } = await supabase.from('aircraft').select('*').eq('operator_id', profile!.operator_id!).order('tail_number');
    if (data) setAircraft(data as Aircraft[]);
    setLoading(false);
  }

  async function handleCreateTrip(withUpload: boolean) {
    if (!selectedAircraft || !profile?.operator_id || !user) return;
    const number = tripNumber || `T${Date.now().toString(36).toUpperCase()}`;
    const { data: trip, error } = await supabase
      .from('trips')
      .insert({ operator_id: profile.operator_id, aircraft_id: selectedAircraft, trip_number: number, status: 'draft', current_fuel_on_board: 0, created_by: user.id })
      .select().single();

    if (error || !trip) { alert(error?.message || 'Failed to create trip'); return; }

    if (withUpload) {
      navigate(`/trips/${trip.id}/upload`);
    } else {
      await supabase.from('trip_legs').insert({ trip_id: trip.id, leg_number: 1, departure_icao: '', destination_icao: '', fuel_price_tiers: [{ price_per_gallon: 0, min_quantity_gallons: 0 }] });
      navigate(`/trips/${trip.id}/legs`);
    }
  }

  async function handleFakeUpload() {
    if (!selectedAircraft || !user || !profile?.operator_id) return;
    setUploading(true);
    const number = tripNumber || `T${Date.now().toString(36).toUpperCase()}`;
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .insert({ operator_id: profile.operator_id, aircraft_id: selectedAircraft, trip_number: number, status: 'draft', current_fuel_on_board: 3200, created_by: user.id })
      .select().single();

    if (tripErr || !trip) { alert(tripErr?.message || 'Failed to create trip'); setUploading(false); return; }

    const sampleLegs = [
      { trip_id: trip.id, leg_number: 1, departure_icao: 'KTEB', destination_icao: 'KPBI', fuel_burn: 2800, reserve: 1800, taxi_fuel_burn: 150, max_takeoff_weight: 20200, max_landing_weight: 18700, crew_weights: [200, 200], passenger_weights: [185, 165], baggage_weight: 120, departure_fee_cost: 350, departure_fee_waived_with: 500, fuel_price_tiers: [{ price_per_gallon: 6.75, min_quantity_gallons: 0 }, { price_per_gallon: 5.90, min_quantity_gallons: 200 }] },
      { trip_id: trip.id, leg_number: 2, departure_icao: 'KPBI', destination_icao: 'KTEB', fuel_burn: 2900, reserve: 1800, taxi_fuel_burn: 150, max_takeoff_weight: 20200, max_landing_weight: 18700, crew_weights: [200, 200], passenger_weights: [185, 165, 200], baggage_weight: 150, departure_fee_cost: 0, departure_fee_waived_with: 0, fuel_price_tiers: [{ price_per_gallon: 7.10, min_quantity_gallons: 0 }, { price_per_gallon: 6.25, min_quantity_gallons: 150 }] },
    ];

    await supabase.from('trip_legs').insert(sampleLegs);
    setUploading(false);
    navigate(`/trips/${trip.id}/legs`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-card transition-all";

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Plan a Trip</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1">Aircraft</label>
          <select value={selectedAircraft} onChange={(e) => setSelectedAircraft(e.target.value)} className={inputCls}>
            <option value="">Select an aircraft</option>
            {aircraft.map((ac) => (
              <option key={ac.id} value={ac.id}>{ac.nickname || ac.tail_number}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1">Trip Number (optional)</label>
          <input type="text" placeholder="e.g. VMMIJF" value={tripNumber} onChange={(e) => setTripNumber(e.target.value)} className={inputCls} />
        </div>
      </div>

      {selectedAircraft && (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">How would you like to add legs?</h2>

          <button
            onClick={handleFakeUpload}
            disabled={uploading}
            className="flex items-center gap-4 w-full p-5 bg-card border border-border rounded-xl hover:border-primary transition-colors text-left"
          >
            <Upload className="w-8 h-8 text-primary shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Upload Itinerary</h3>
              <p className="text-sm text-muted-foreground">Simulates a successful PDF upload with sample KTEB↔KPBI legs</p>
            </div>
          </button>

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
              Uploading and processing...
            </div>
          )}

          <button
            onClick={() => handleCreateTrip(false)}
            className="flex items-center gap-4 w-full p-5 bg-card border border-border rounded-xl hover:border-primary transition-colors text-left"
          >
            <Plus className="w-8 h-8 text-muted-foreground shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground">No Itinerary</h3>
              <p className="text-sm text-muted-foreground">Add a blank leg and fill out all the details manually</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
