import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/hooks/useAuthContext';
import { AIRCRAFT_TYPE_LABELS, type Aircraft } from '@/types/database';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';

export default function AircraftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuthContext();
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAircraft();
  }, [id]);

  async function loadAircraft() {
    const { data } = await supabase
      .from('aircraft')
      .select('*')
      .eq('id', id!)
      .single();

    if (data) setAircraft(data as Aircraft);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this aircraft?')) return;
    await supabase.from('aircraft').delete().eq('id', id!);
    navigate('/fleet');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-skyiq-accent" />
      </div>
    );
  }

  if (!aircraft) return <p>Aircraft not found.</p>;

  const isAdmin = profile?.role === 'operator_admin' || profile?.role === 'super_admin';

  const fields = [
    ['Tail Number', aircraft.tail_number],
    ['Nickname', aircraft.nickname || '-'],
    ['Type', AIRCRAFT_TYPE_LABELS[aircraft.aircraft_type]],
    ['Manufacturer', aircraft.manufacturer],
    ['Model', aircraft.model],
    ['Basic Empty Weight', `${aircraft.basic_empty_weight} lbs`],
    ['Max Takeoff Weight', `${aircraft.max_takeoff_weight} lbs`],
    ['Max Landing Weight', `${aircraft.max_landing_weight} lbs`],
    ['Max Ramp Weight', `${aircraft.max_ramp_weight} lbs`],
    ['Preferred Reserve', `${aircraft.preferred_reserve} lbs`],
    ['Max Fuel Capacity', `${aircraft.max_fuel_capacity} lbs`],
    ['Taxi Fuel Burn', `${aircraft.taxi_fuel_burn} lbs`],
    ['Default PAX Weight', `${aircraft.default_pax_weight} lbs`],
    ['Baggage w/ PAX', `${aircraft.baggage_weight_with_pax} lbs`],
    ['Baggage w/o PAX', `${aircraft.baggage_weight_without_pax} lbs`],
    ['Default PIC Weight', `${aircraft.default_pic_weight} lbs`],
    ['Default SIC Weight', `${aircraft.default_sic_weight} lbs`],
    ['Cabin Attendant Weight', `${aircraft.cabin_attendant_weight} lbs`],
    ['Cruise Fuel Burn', `${aircraft.cruise_fuel_burn}`],
    ['Penalty Rate', `${aircraft.penalty_rate}`],
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/fleet')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Fleet
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {aircraft.nickname || aircraft.tail_number}
        </h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/fleet/${id}/edit`)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-red-50 rounded-lg text-red-500"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl divide-y">
        {fields.map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-gray-600">{label}</span>
            <span className="font-medium text-gray-900">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
