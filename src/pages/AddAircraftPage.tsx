import { useState, useMemo, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Search, Check } from 'lucide-react';
import {
  getManufacturers,
  getModelsForManufacturer,
  type AircraftPreset,
} from '@/lib/aircraft-presets';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const WEIGHT_FIELDS = [
  { key: 'max_takeoff_weight', label: 'Max Takeoff Weight (lbs)' },
  { key: 'max_landing_weight', label: 'Max Landing Weight (lbs)' },
  { key: 'max_ramp_weight', label: 'Max Ramp Weight (lbs)' },
  { key: 'max_fuel_capacity', label: 'Max Fuel Capacity (lbs)' },
  { key: 'preferred_reserve', label: 'Preferred Reserve (lbs)' },
  { key: 'taxi_fuel_burn', label: 'Taxi Fuel Burn (lbs)' },
  { key: 'cruise_fuel_burn', label: 'Cruise Fuel Burn (lbs/hr)' },
  { key: 'penalty_rate', label: 'Penalty Rate' },
] as const;

const CREW_FIELDS = [
  { key: 'default_pax_weight', label: 'Default PAX Weight' },
  { key: 'default_baggage_with_pax', label: 'Baggage w/ PAX' },
  { key: 'default_baggage_no_pax', label: 'Baggage w/o PAX' },
  { key: 'default_pic_weight', label: 'PIC Weight' },
  { key: 'default_sic_weight', label: 'SIC Weight' },
  { key: 'default_cabin_weight', label: 'Cabin Attendant' },
] as const;

export default function AddAircraftPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Manufacturer / Model selection
  const [mfgOpen, setMfgOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [selectedMfg, setSelectedMfg] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<AircraftPreset | null>(null);

  // Form fields
  const [tailNumber, setTailNumber] = useState('');
  const [basicEmptyWeight, setBasicEmptyWeight] = useState('');
  const [formData, setFormData] = useState<Record<string, number>>({
    max_takeoff_weight: 0,
    max_landing_weight: 0,
    max_ramp_weight: 0,
    max_fuel_capacity: 0,
    preferred_reserve: 0,
    taxi_fuel_burn: 0,
    cruise_fuel_burn: 0,
    penalty_rate: 0,
    default_pax_weight: 177,
    default_baggage_with_pax: 200,
    default_baggage_no_pax: 50,
    default_pic_weight: 200,
    default_sic_weight: 200,
    default_cabin_weight: 0,
  });

  const manufacturers = useMemo(() => getManufacturers(), []);
  const models = useMemo(
    () => (selectedMfg ? getModelsForManufacturer(selectedMfg) : []),
    [selectedMfg],
  );

  function applyPreset(preset: AircraftPreset) {
    setSelectedPreset(preset);
    setFormData((prev) => ({
      ...prev,
      max_takeoff_weight: preset.mtow,
      max_landing_weight: preset.mlw,
      max_ramp_weight: preset.mrw,
      max_fuel_capacity: preset.maxFuel,
      preferred_reserve: preset.preferredReserve,
      taxi_fuel_burn: preset.taxiFuel,
      cruise_fuel_burn: preset.cruiseBurn,
      penalty_rate: preset.penaltyRate,
      default_cabin_weight: preset.defaultCabinWeight,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!tailNumber.trim()) {
      setError('Tail number is required');
      return;
    }
    setError('');
    setLoading(true);

    const payload: Record<string, any> = {
      ...formData,
      tail_number: tailNumber.trim().toUpperCase(),
      basic_empty_weight: parseFloat(basicEmptyWeight) || 0,
      manufacturer: selectedMfg,
      type: selectedPreset?.model ?? '',
      user_company: user.id,
    };

    const { error: dbError } = await supabase.from('aircrafts').insert(payload as any);
    if (dbError) {
      setError(dbError.message);
      setLoading(false);
    } else {
      navigate('/fleet');
    }
  }

  const inputCls =
    'flex-1 px-3 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-card transition-all';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/fleet')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Add Aircraft</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Manufacturer */}
        <div className="space-y-2">
          <Label>Manufacturer</Label>
          <Popover open={mfgOpen} onOpenChange={setMfgOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={mfgOpen}
                className="w-full justify-between font-normal"
              >
                {selectedMfg || 'Select manufacturer…'}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search manufacturer…" />
                <CommandList>
                  <CommandEmpty>No manufacturer found.</CommandEmpty>
                  <CommandGroup>
                    {manufacturers.map((mfg) => (
                      <CommandItem
                        key={mfg}
                        value={mfg}
                        onSelect={() => {
                          setSelectedMfg(mfg);
                          setSelectedPreset(null);
                          setMfgOpen(false);
                        }}
                      >
                        <Check
                          className={cn('mr-2 h-4 w-4', selectedMfg === mfg ? 'opacity-100' : 'opacity-0')}
                        />
                        {mfg}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Step 2: Model (filtered by manufacturer) */}
        {selectedMfg && (
          <div className="space-y-2">
            <Label>Type / Model</Label>
            <Popover open={modelOpen} onOpenChange={setModelOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={modelOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedPreset?.model || 'Select model…'}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search model…" />
                  <CommandList>
                    <CommandEmpty>No model found.</CommandEmpty>
                    <CommandGroup>
                      {models.map((preset) => (
                        <CommandItem
                          key={preset.id}
                          value={preset.model}
                          onSelect={() => {
                            applyPreset(preset);
                            setModelOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedPreset?.id === preset.id ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          {preset.model}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Step 3: User enters tail + BEW */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tail Number *</Label>
            <input
              type="text"
              value={tailNumber}
              onChange={(e) => setTailNumber(e.target.value)}
              placeholder="N12345"
              required
              className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <Label>Basic Empty Weight (lbs) *</Label>
            <input
              type="number"
              value={basicEmptyWeight}
              onChange={(e) => setBasicEmptyWeight(e.target.value)}
              placeholder="From W&B report"
              className={inputCls}
            />
          </div>
        </div>

        {/* Auto-filled fields — editable */}
        {selectedPreset && (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Performance (auto-filled)
              </p>
              <div className="grid grid-cols-2 gap-3">
                {WEIGHT_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{field.label}</Label>
                    <input
                      type="number"
                      step="any"
                      value={formData[field.key] ?? ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))
                      }
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Defaults (editable)
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CREW_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{field.label}</Label>
                    <input
                      type="number"
                      value={formData[field.key] ?? ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))
                      }
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="pt-2">
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Adding…' : 'Add Aircraft'}
          </Button>
        </div>
      </form>
    </div>
  );
}
