import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const AIRCRAFT_FIELDS = [
  { key: 'tail_number', label: 'Tail Number', type: 'text' },
  { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
  { key: 'type', label: 'Type', type: 'text' },
  { key: 'basic_empty_weight', label: 'Basic Empty Weight (lbs.)', type: 'number' },
  { key: 'max_takeoff_weight', label: 'Max Takeoff Weight (lbs.)', type: 'number' },
  { key: 'max_landing_weight', label: 'Max Landing Weight (lbs.)', type: 'number' },
  { key: 'max_ramp_weight', label: 'Max Ramp Weight (lbs.)', type: 'number' },
  { key: 'preferred_reserve', label: 'Preferred Reserve (lbs.)', type: 'number' },
  { key: 'max_fuel_capacity', label: 'Max Fuel Capacity (lbs.)', type: 'number' },
  { key: 'taxi_fuel_burn', label: 'Taxi Fuel Burn (lbs.)', type: 'number' },
  { key: 'default_pax_weight', label: 'Default PAX Weight', type: 'number' },
  { key: 'default_baggage_with_pax', label: 'Baggage Weight with PAX', type: 'number' },
  { key: 'default_baggage_no_pax', label: 'Baggage Weight without PAX', type: 'number' },
  { key: 'default_pic_weight', label: 'Default PIC Weight', type: 'number' },
  { key: 'default_sic_weight', label: 'Default SIC Weight', type: 'number' },
  { key: 'default_cabin_weight', label: 'Cabin Attendant Weight', type: 'number' },
  { key: 'cruise_fuel_burn', label: 'Cruise Fuel Burn', type: 'number' },
  { key: 'penalty_rate', label: 'Penalty Rate', type: 'number' },
] as const;

export default function AddAircraftPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, string | number>>({});

  function updateField(key: string, value: string | number) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);

    const payload: Record<string, any> = { ...formData, user_company: user.id };
    for (const field of AIRCRAFT_FIELDS) {
      if (field.type === 'number' && payload[field.key]) {
        payload[field.key] = Number(payload[field.key]);
      }
    }

    const { error } = await supabase.from('aircrafts').insert(payload as any);
    if (error) { setError(error.message); setLoading(false); } else { navigate('/fleet'); }
  }

  const inputCls = "flex-1 px-3 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-card transition-all";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/fleet')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Add an Aircraft</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {AIRCRAFT_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="sm:w-64 text-sm font-medium text-foreground/80 shrink-0">{field.label}</label>
            <input type={field.type} value={formData[field.key] ?? ''} onChange={(e) => updateField(field.key, e.target.value)} required={field.key === 'tail_number'} className={inputCls} />
          </div>
        ))}

        <div className="pt-4">
          <button type="submit" disabled={loading} className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all">
            {loading ? 'Adding...' : 'Add Aircraft'}
          </button>
        </div>
      </form>
    </div>
  );
}
