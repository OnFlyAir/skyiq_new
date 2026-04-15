import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Trash2, Search, Check, ChevronDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  getManufacturers,
  getModelsForManufacturer,
  type AircraftPreset,
} from "@/lib/aircraft-presets";

const WEIGHT_FIELDS = [
  { key: "max_takeoff_weight", label: "MTOW" },
  { key: "max_landing_weight", label: "MLW" },
  { key: "max_ramp_weight", label: "MRW" },
  { key: "max_fuel_capacity", label: "Max Fuel" },
  { key: "preferred_reserve", label: "Reserve" },
  { key: "taxi_fuel_burn", label: "Taxi Burn" },
  { key: "cruise_fuel_burn", label: "Cruise Burn" },
  { key: "penalty_rate", label: "Penalty" },
] as const;

const CREW_FIELDS = [
  { key: "default_pax_weight", label: "PAX Wt" },
  { key: "default_baggage_with_pax", label: "Bags w/ PAX" },
  { key: "default_baggage_no_pax", label: "Bags w/o PAX" },
  { key: "default_pic_weight", label: "PIC Wt" },
  { key: "default_sic_weight", label: "SIC Wt" },
  { key: "default_cabin_weight", label: "Cabin Att." },
] as const;

export default function AircraftEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mfgOpen, setMfgOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [selectedMfg, setSelectedMfg] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<AircraftPreset | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [tailNumber, setTailNumber] = useState("");
  const [basicEmptyWeight, setBew] = useState("");
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

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data, error } = await supabase
        .from("aircrafts")
        .select("*")
        .eq("id", parseInt(id))
        .single();

      if (error || !data) {
        toast({ title: "Error", description: "Aircraft not found", variant: "destructive" });
        navigate("/fleet");
        return;
      }

      setTailNumber(data.tail_number ?? "");
      setBew(String(data.basic_empty_weight ?? 0));
      setSelectedMfg(data.manufacturer ?? "");

      // Try to match existing preset
      const mfgModels = getModelsForManufacturer(data.manufacturer ?? "");
      const match = mfgModels.find((p) => p.model === data.type);
      if (match) setSelectedPreset(match);

      setFormData({
        max_takeoff_weight: data.max_takeoff_weight ?? 0,
        max_landing_weight: data.max_landing_weight ?? 0,
        max_ramp_weight: data.max_ramp_weight ?? 0,
        max_fuel_capacity: data.max_fuel_capacity ?? 0,
        preferred_reserve: data.preferred_reserve ?? 0,
        taxi_fuel_burn: data.taxi_fuel_burn ?? 0,
        cruise_fuel_burn: data.cruise_fuel_burn ?? 0,
        penalty_rate: data.penalty_rate ?? 0,
        default_pax_weight: data.default_pax_weight ?? 177,
        default_baggage_with_pax: data.default_baggage_with_pax ?? 200,
        default_baggage_no_pax: data.default_baggage_no_pax ?? 50,
        default_pic_weight: data.default_pic_weight ?? 200,
        default_sic_weight: data.default_sic_weight ?? 200,
        default_cabin_weight: data.default_cabin_weight ?? 0,
      });
      setLoading(false);
    }
    load();
  }, [id]);

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

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);

    const payload: Record<string, any> = {
      ...formData,
      tail_number: tailNumber.trim().toUpperCase(),
      basic_empty_weight: parseFloat(basicEmptyWeight) || 0,
      manufacturer: selectedMfg,
      type: selectedPreset?.model ?? "",
    };

    const { error } = await supabase
      .from("aircrafts")
      .update(payload)
      .eq("id", parseInt(id));

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to save aircraft", variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: `${tailNumber} updated successfully` });
  };

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase
      .from("aircrafts")
      .update({ is_enabled: false } as any)
      .eq("id", parseInt(id));

    if (error) {
      toast({ title: "Error", description: "Failed to delete aircraft", variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: "Aircraft removed from fleet" });
    navigate("/fleet");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/fleet")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Edit {tailNumber}</h1>
      </div>

      {/* Aircraft Selection */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Manufacturer</Label>
            <Popover open={mfgOpen} onOpenChange={setMfgOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-11">
                  {selectedMfg || "Select manufacturer…"}
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
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedMfg === mfg ? "opacity-100" : "opacity-0")} />
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
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-11">
                    {selectedPreset?.model || "Select model…"}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search…" />
                    <CommandList>
                      <CommandEmpty>No match.</CommandEmpty>
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
                            <Check className={cn("mr-2 h-4 w-4", selectedPreset?.id === preset.id ? "opacity-100" : "opacity-0")} />
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
        </CardContent>
      </Card>

      {/* Tail + BEW */}
      <Card>
        <CardContent className="pt-5 grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tail Number</Label>
            <Input value={tailNumber} onChange={(e) => setTailNumber(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Empty Weight (lbs)</Label>
            <Input type="number" value={basicEmptyWeight} onChange={(e) => setBew(e.target.value)} className="h-11" />
          </div>
        </CardContent>
      </Card>

      {/* Performance & defaults — collapsible */}
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full px-4 py-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <span className="text-sm text-muted-foreground">
              Performance & defaults
              {selectedPreset && <span className="ml-1.5 text-xs opacity-60">(auto-filled)</span>}
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", detailsOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {WEIGHT_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">{field.label}</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formData[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="h-9 w-24 text-right text-sm"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {CREW_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">{field.label}</Label>
                    <Input
                      type="number"
                      value={formData[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="h-9 w-24 text-right text-sm"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} size="lg" className="flex-1">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Aircraft
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="lg">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {tailNumber}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the aircraft from your fleet. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
