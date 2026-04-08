import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';
import type { Aircraft } from '@/types/database';

export default function NewTripPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<string>('');
  const [tripNumber, setTripNumber] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) { loadAircraft(); } else { setLoading(false); }
  }, [user]);

  async function loadAircraft() {
    const { data } = await supabase.from('aircrafts').select('*').eq('user_company', user!.id).order('tail_number');
    if (data) setAircraft(data as unknown as Aircraft[]);
    setLoading(false);
  }

  async function handleCreateTrip() {
    if (!selectedAircraft || !user) return;
    const number = tripNumber || `T${Date.now().toString(36).toUpperCase()}`;

    // Create trip with empty details — the legs page will build the itinerary
    const { data: trip, error } = await supabase
      .from('trips')
      .insert({ user_company: user.id, itinerary_num: number, details: {}, itinerary_details: {}, savings: 0 } as any)
      .select()
      .single();

    if (error || !trip) { alert(error?.message || 'Failed to create trip'); return; }
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
              <option key={ac.id} value={ac.id}>{ac.tail_number}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-1">Trip Number (optional)</label>
          <input type="text" placeholder="e.g. VMMIJF" value={tripNumber} onChange={(e) => setTripNumber(e.target.value)} className={inputCls} />
        </div>
      </div>

      {selectedAircraft && (
        <div className="mt-8">
          <button onClick={handleCreateTrip} className="flex items-center gap-4 w-full p-5 bg-card border border-border rounded-xl hover:border-primary transition-colors text-left">
            <Plus className="w-8 h-8 text-primary shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground">Create Trip</h3>
              <p className="text-sm text-muted-foreground">Set up legs and run optimization</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
