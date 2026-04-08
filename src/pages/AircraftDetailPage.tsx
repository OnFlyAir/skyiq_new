import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Aircraft } from '@/types/database';
import { ArrowLeft, Trash2 } from 'lucide-react';

export default function AircraftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAircraft(); }, [id]);

  async function loadAircraft() {
    const { data } = await supabase.from('aircrafts').select('*').eq('id', Number(id)).single();
    if (data) setAircraft(data as unknown as Aircraft);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this aircraft?')) return;
    await supabase.from('aircrafts').delete().eq('id', Number(id));
    navigate('/fleet');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!aircraft) return <p className="text-muted-foreground">Aircraft not found.</p>;

  const fields: [string, string | number][] = [
    ['Tail Number', aircraft.tail_number],
    ['Type', aircraft.type],
    ['Manufacturer', aircraft.manufacturer],
    ['Basic Empty Weight', `${aircraft.basic_empty_weight} lbs`],
    ['Max Takeoff Weight', `${aircraft.max_takeoff_weight} lbs`],
    ['Max Landing Weight', `${aircraft.max_landing_weight} lbs`],
    ['Max Ramp Weight', `${aircraft.max_ramp_weight} lbs`],
    ['Preferred Reserve', `${aircraft.preferred_reserve} lbs`],
    ['Max Fuel Capacity', `${aircraft.max_fuel_capacity} lbs`],
    ['Taxi Fuel Burn', `${aircraft.taxi_fuel_burn} lbs`],
    ['Default PAX Weight', `${aircraft.default_pax_weight} lbs`],
    ['Baggage w/ PAX', `${aircraft.default_baggage_with_pax} lbs`],
    ['Baggage w/o PAX', `${aircraft.default_baggage_no_pax} lbs`],
    ['Default PIC Weight', `${aircraft.default_pic_weight} lbs`],
    ['Default SIC Weight', `${aircraft.default_sic_weight} lbs`],
    ['Cabin Attendant Weight', `${aircraft.default_cabin_weight} lbs`],
    ['Cruise Fuel Burn', aircraft.cruise_fuel_burn],
    ['Penalty Rate', aircraft.penalty_rate],
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate('/fleet')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Fleet
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">{aircraft.tail_number}</h1>
        <button onClick={handleDelete} className="p-2 hover:bg-destructive/10 rounded-lg text-destructive transition-colors" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {fields.map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
