import { useState, useMemo, useEffect, useRef, FormEvent } from 'react';
import { useDemo } from '@/contexts/DemoContext';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Search, Check, ChevronDown } from 'lucide-react';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

const WEIGHT_FIELDS = [
  { key: 'max_takeoff_weight', label: 'MTOW' },
  { key: 'max_landing_weight', label: 'MLW' },
  { key: 'max_ramp_weight', label: 'MRW' },
  { key: 'max_fuel_capacity', label: 'Max Fuel' },
  { key: 'preferred_reserve', label: 'Reserve' },
  { key: 'taxi_fuel_burn', label: 'Taxi Burn' },
  { key: 'cruise_fuel_burn', label: 'Cruise Burn' },
  { key: 'penalty_rate', label: 'Penalty' },
] as const;

const CREW_FIELDS = [
  { key: 'default_pax_weight', label: 'PAX Wt' },
  { key: 'default_baggage_with_pax', label: 'Bags w/ PAX' },
  { key: 'default_baggage_no_pax', label: 'Bags w/o PAX' },
  { key: 'default_pic_weight', label: 'PIC Wt' },
  { key: 'default_sic_weight', label: 'SIC Wt' },
  { key: 'default_cabin_weight', label: 'Cabin Att.' },
] as const;

export default function AddAircraftPage() {
  const { user } = useAuthContext();
  const { active: demoActive, currentStep } = useDemo();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [mfgOpen, setMfgOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [selectedMfg, setSelectedMfg] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<AircraftPreset | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  // Demo mode: auto-fill the entire form so the user can just click Next.
  const demoFilled = useRef(false);
  useEffect(() => {
    if (!demoActive || demoFilled.current) return;
    const cessnaModels = getModelsForManufacturer('Cessna / Textron');
    const cj3 = cessnaModels.find((m) => m.model === 'Citation CJ3 (C525B)');
    if (!cj3) return;
    demoFilled.current = true;
    setSelectedMfg('Cessna / Textron');
    setSelectedPreset(cj3);
    setFormData((prev) => ({
      ...prev,
      max_takeoff_weight: cj3.mtow,
      max_landing_weight: cj3.mlw,
      max_ramp_weight: cj3.mrw,
      max_fuel_capacity: cj3.maxFuel,
      preferred_reserve: cj3.preferredReserve,
      taxi_fuel_burn: cj3.taxiFuel,
      cruise_fuel_burn: cj3.cruiseBurn,
      penalty_rate: cj3.penaltyRate,
      default_cabin_weight: cj3.defaultCabinWeight,
    }));
    setTailNumber('NSKYIQ');
    setBasicEmptyWeight('8300');
    setDetailsOpen(true);
  }, [demoActive]);

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

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  return (
    <div className="max-w-lg mx-auto p-4 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/fleet')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Add Aircraft</h1>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Aircraft Selection */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Manufacturer</Label>
              <Popover open={mfgOpen} onOpenChange={setMfgOpen} data-demo="manufacturer-select">
                <PopoverTrigger asChild>
                  <Button
                    data-demo="manufacturer-select"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal h-11"
                  >
                    {selectedMfg || 'Select manufacturer…'}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search…" />
                    <CommandList>
                      <CommandEmpty>No match.</CommandEmpty>
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
                            className={cn(
                              demoActive && currentStep?.id === 'select-manufacturer' && mfg === 'Cessna / Textron'
                                && 'bg-primary text-primary-foreground animate-pulse'
                            )}
                          >
                            <Check className={cn('mr-2 h-4 w-4', selectedMfg === mfg ? 'opacity-100' : 'opacity-0')} />
                            {mfg}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selectedMfg && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Model</Label>
                <Popover open={modelOpen} onOpenChange={setModelOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      data-demo="model-select"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal h-11"
                    >
                      {selectedPreset?.model || 'Select model…'}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search…" />
                      <CommandList>
                        <CommandEmpty>No match.</CommandEmpty>
                        <CommandGroup>
                          {models.map((preset) => {
                            const isTarget = preset.model === 'Citation CJ3 (C525B)';
                            return (
                              <CommandItem
                                key={preset.id}
                                value={preset.model}
                                ref={(el) => {
                                  if (isTarget && el && demoActive && currentStep?.id === 'select-model') {
                                    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
                                  }
                                }}
                                onSelect={() => {
                                  applyPreset(preset);
                                  setModelOpen(false);
                                }}
                                className={cn(
                                  demoActive && currentStep?.id === 'select-model' && isTarget
                                    && 'bg-primary text-primary-foreground animate-pulse'
                                )}
                              >
                                <Check className={cn('mr-2 h-4 w-4', selectedPreset?.id === preset.id ? 'opacity-100' : 'opacity-0')} />
                                {preset.model}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tail + BEW */}
        <Card>
          <CardContent className="pt-5 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tail Number</Label>
              <Input
                data-demo="tail-number-input"
                value={tailNumber}
                onChange={(e) => setTailNumber(e.target.value)}
                placeholder="N12345"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Empty Weight (lbs)</Label>
              <Input
                data-demo="bew-input"
                type="number"
                value={basicEmptyWeight}
                onChange={(e) => setBasicEmptyWeight(e.target.value)}
                placeholder="From W&B"
                className="h-11"
              />
            </div>
          </CardContent>
        </Card>

        {/* Auto-filled details — collapsible */}
        {selectedPreset && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                data-demo="performance-defaults-toggle"
                className="flex items-center justify-between w-full px-4 py-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <span className="text-sm text-muted-foreground">
                  Performance & defaults
                  <span className="ml-1.5 text-xs opacity-60">(auto-filled)</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", detailsOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent data-demo="performance-defaults-section" className="mt-3 space-y-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                    {WEIGHT_FIELDS.map((field) => (
                      <div key={field.key} className="flex items-center justify-between gap-3">
                        <Label className="text-xs text-muted-foreground">{field.label}</Label>
                        <Input
                          type="number"
                          step="any"
                          value={formData[field.key] ?? ''}
                          onChange={(e) => updateField(field.key, e.target.value)}
                          className="h-9 w-28 shrink-0 text-right text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                    {CREW_FIELDS.map((field) => (
                      <div key={field.key} className="flex items-center justify-between gap-3">
                        <Label className="text-xs text-muted-foreground">{field.label}</Label>
                        <Input
                          type="number"
                          value={formData[field.key] ?? ''}
                          onChange={(e) => updateField(field.key, e.target.value)}
                          className="h-9 w-28 shrink-0 text-right text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}

        <Button data-demo="save-aircraft-btn" type="submit" disabled={loading} size="lg" className="w-full">
          {loading ? 'Adding…' : 'Add Aircraft'}
        </Button>
      </form>
    </div>
  );
}
