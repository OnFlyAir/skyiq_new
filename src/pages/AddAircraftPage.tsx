import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AIRCRAFT_TYPE_LABELS, type AircraftType } from '@/types/database';

const AIRCRAFT_FIELDS = [
  { key: 'tail_number', label: 'Tail Number', type: 'text' },
  { key: 'nickname', label: 'Nickname (optional)', type: 'text' },
  { key: 'basic_empty_weight', label: 'Basic Empty Weight (lbs.)', type: 'number' },
  { key: 'max_takeoff_weight', label: 'Max Takeoff Weight (lbs.)', type: 'number' },
  { key: 'max_landing_weight', label: 'Max Landing Weight (lbs.)', type: 'number' },
  { key: 'max_ramp_weight', label: 'Max Ramp Weight (lbs.)', type: 'number' },
  { key: 'preferred_reserve', label: 'Preferred Reserve (lbs.)', type: 'number' },
  { key: 'max_fuel_capacity', label: 'Max Fuel Capacity (lbs.)', type: 'number' },
  { key: 'taxi_fuel_burn', label: 'Taxi Fuel Burn (lbs.)', type: 'number' },
  { key: 'default_pax_weight', label: 'Default PAX Weight', type: 'number' },
  { key: 'baggage_weight_with_pax', label: 'Baggage Weight with PAX', type: 'number' },
  { key: 'baggage_weight_without_pax', label: 'Baggage Weight without PAX', type: 'number' },
  { key: 'default_pic_weight', label: 'Default PIC Weight', type: 'number' },
  { key: 'default_sic_weight', label: 'Default SIC Weight', type: 'number' },
  { key: 'cabin_attendant_weight', label: 'Cabin Attendant Weight', type: 'number' },
  { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
  { key: 'model', label: 'Model', type: 'text' },
  { key: 'cruise_fuel_burn', label: 'Cruise Fuel Burn', type: 'number' },
  { key: 'penalty_rate', label: 'Penalty Rate', type: 'number' },
] as const;

export default function AddAircraftPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, string | number>>({
    aircraft_type: 'midsize_jet',
  });

  function updateField(key: string, value: string | number) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.operator_id) return;
    setError('');
    setLoading(true);

    const payload = {
      ...formData,
      operator_id: profile.operator_id,
    };

    // Convert numeric fields
    for (const field of AIRCRAFT_FIELDS) {
      if (field.type === 'number' && payload[field.key]) {
        payload[field.key] = Number(payload[field.key]);
      }
    }

    const { error } = await supabase.from('aircraft').insert(payload);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/fleet');
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add an Aircraft</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {AIRCRAFT_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="sm:w-64 text-sm font-medium text-gray-700 shrink-0">
              {field.label}
            </label>
            <input
              type={field.type}
              value={formData[field.key] ?? ''}
              onChange={(e) => updateField(field.key, e.target.value)}
              required={field.key !== 'nickname'}
              className="flex-1 px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-skyiq-accent focus:bg-white"
            />
          </div>
        ))}

        {/* Aircraft Type Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="sm:w-64 text-sm font-medium text-gray-700 shrink-0">Type</label>
          <select
            value={formData.aircraft_type as string}
            onChange={(e) => updateField('aircraft_type', e.target.value)}
            className="flex-1 px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-skyiq-accent focus:bg-white"
          >
            {Object.entries(AIRCRAFT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-skyiq-accent text-white font-medium rounded-lg hover:bg-skyiq-accent/90 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Aircraft'}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Ensure this data is accurate. You can make edits from the manage fleet menu.
          </p>
        </div>
      </form>
    </div>
  );
}
