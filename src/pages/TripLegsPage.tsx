// TripLegsPage — Step 1 of trip planning: configure each leg of the trip.
// Route: /trips/:tripId/legs
// Supports PDF upload (AI parsing), manual entry, and per-leg editing.
// Each leg has: departure/destination, fuel prices (tiered), fees, crew, pax, weights.

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parsedLegsToFormData } from "@/lib/itinerary-service";
import { API_URL } from "@/lib/config";
import type { TripFormData, LegFormData, FuelTier } from "@/types/trip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileUp,
  Loader2,
  Plus,
  Trash2,
  X,
  Plane,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- Default empty leg ---
function emptyLeg(legNum: number): LegFormData {
  return {
    legNum,
    departure: "",
    destination: "",
    departureFuelPrices: [{ min_fuel: 0, price: 0 }],
    waivedFee: { name: "", amount: 0, isWaivable: false, waivedAt: 0, airport: "" },
    passengerWeights: "0",
    baggage: 0,
    crewWeight: "180, 180, 0",
    fuelBurn: 0,
    reserve: 0,
    taxiFuelBurn: 0,
    maxTakeoffWeight: 0,
    maxLandingWeight: 0,
    maxRampWeight: 0,
    isConfirmed: false,
  };
}

// --- Fuel Price Tier Row ---
function FuelPriceRow({
  tier,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  tier: FuelTier;
  index: number;
  onChange: (index: number, field: keyof FuelTier, value: number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Input
          type="number"
          placeholder="Min gal"
          value={tier.min_fuel || ""}
          onChange={(e) => onChange(index, "min_fuel", parseFloat(e.target.value) || 0)}
          className="text-sm"
        />
      </div>
      <div className="flex-1">
        <Input
          type="number"
          step="0.01"
          placeholder="$/gal"
          value={tier.price || ""}
          onChange={(e) => onChange(index, "price", parseFloat(e.target.value) || 0)}
          className="text-sm"
        />
      </div>
      {canRemove && (
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)} className="h-8 w-8">
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// --- Single Leg Editor ---
function LegEditor({
  leg,
  onUpdate,
  onConfirm,
  onUnconfirm,
  onRemove,
  aircraftDefaults,
}: {
  leg: LegFormData;
  onUpdate: (leg: LegFormData) => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
  onRemove: () => void;
  aircraftDefaults: { reserve: number; taxiFuelBurn: number; maxTakeoff: number; maxLanding: number; maxRamp: number };
}) {
  const isConfirmed = leg.isConfirmed;

  const updateField = <K extends keyof LegFormData>(field: K, value: LegFormData[K]) => {
    onUpdate({ ...leg, [field]: value });
  };

  const updateFuelTier = (index: number, field: keyof FuelTier, value: number) => {
    const tiers = [...leg.departureFuelPrices];
    tiers[index] = { ...tiers[index], [field]: value };
    updateField("departureFuelPrices", tiers);
  };

  const addFuelTier = () => {
    updateField("departureFuelPrices", [...leg.departureFuelPrices, { min_fuel: 0, price: 0 }]);
  };

  const removeFuelTier = (index: number) => {
    updateField("departureFuelPrices", leg.departureFuelPrices.filter((_, i) => i !== index));
  };

  // Apply aircraft defaults on first render if values are 0
  useEffect(() => {
    if (leg.reserve === 0 && aircraftDefaults.reserve > 0) {
      onUpdate({
        ...leg,
        reserve: aircraftDefaults.reserve,
        taxiFuelBurn: aircraftDefaults.taxiFuelBurn,
        maxTakeoffWeight: aircraftDefaults.maxTakeoff,
        maxLandingWeight: aircraftDefaults.maxLanding,
        maxRampWeight: aircraftDefaults.maxRamp,
      });
    }
  }, []);

  return (
    <Card className={`transition-all ${isConfirmed ? "border-green-300 bg-green-50/30" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Plane className="h-4 w-4" />
            Leg {leg.legNum}
            {isConfirmed && <Check className="h-4 w-4 text-green-600" />}
          </CardTitle>
          <div className="flex items-center gap-1">
            {!isConfirmed ? (
              <Button
                size="sm"
                onClick={onConfirm}
                disabled={!leg.departure || !leg.destination}
                className="bg-green-600 hover:bg-green-700 text-xs"
              >
                <Check className="h-3 w-3 mr-1" /> Confirm
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onUnconfirm} className="text-xs">
                Edit
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onRemove} className="text-red-500 hover:text-red-700">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isConfirmed && (
        <CardContent className="space-y-4">
          {/* Route */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Departure (ICAO)</Label>
              <Input
                value={leg.departure}
                onChange={(e) => updateField("departure", e.target.value.toUpperCase())}
                placeholder="KJFK"
                maxLength={4}
              />
            </div>
            <div>
              <Label className="text-xs">Destination (ICAO)</Label>
              <Input
                value={leg.destination}
                onChange={(e) => updateField("destination", e.target.value.toUpperCase())}
                placeholder="KLAX"
                maxLength={4}
              />
            </div>
          </div>

          {/* Fuel Prices */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              Departure Fuel Prices
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent><p className="max-w-[200px] text-xs">Tiered pricing: if you buy more than the minimum gallons, the lower price applies to all gallons.</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <div className="space-y-2 mt-1">
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground px-1">
                <span>Min Gallons</span>
                <span>Price/Gal</span>
              </div>
              {leg.departureFuelPrices.map((tier, i) => (
                <FuelPriceRow
                  key={i}
                  tier={tier}
                  index={i}
                  onChange={updateFuelTier}
                  onRemove={removeFuelTier}
                  canRemove={leg.departureFuelPrices.length > 1}
                />
              ))}
              <Button variant="outline" size="sm" onClick={addFuelTier} className="text-xs w-full">
                <Plus className="h-3 w-3 mr-1" /> Add price tier
              </Button>
            </div>
          </div>

          {/* Fee Waiver */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Fee Amount ($)</Label>
              <Input
                type="number"
                value={leg.waivedFee.amount || ""}
                onChange={(e) => updateField("waivedFee", { ...leg.waivedFee, amount: parseFloat(e.target.value) || 0, isWaivable: true })}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs">Waived at (gal)</Label>
              <Input
                type="number"
                value={leg.waivedFee.waivedAt || ""}
                onChange={(e) => updateField("waivedFee", { ...leg.waivedFee, waivedAt: parseFloat(e.target.value) || 0, isWaivable: true })}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs">Fee Airport</Label>
              <Input
                value={leg.waivedFee.airport}
                onChange={(e) => updateField("waivedFee", { ...leg.waivedFee, airport: e.target.value.toUpperCase() })}
                placeholder={leg.departure || "ICAO"}
                maxLength={4}
              />
            </div>
          </div>

          {/* Crew & Passengers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs flex items-center gap-1">
                Crew Weights (PIC, SIC, FA)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent><p className="text-xs">Comma-separated: PIC, SIC, Flight Attendant</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                value={leg.crewWeight}
                onChange={(e) => updateField("crewWeight", e.target.value)}
                placeholder="180, 180, 0"
              />
            </div>
            <div>
              <Label className="text-xs">Passenger Weights</Label>
              <Input
                value={leg.passengerWeights}
                onChange={(e) => updateField("passengerWeights", e.target.value)}
                placeholder="180, 200"
              />
            </div>
          </div>

          {/* Baggage */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Baggage (lbs)</Label>
              <Input
                type="number"
                value={leg.baggage || ""}
                onChange={(e) => updateField("baggage", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Reserve (lbs)</Label>
              <Input
                type="number"
                value={leg.reserve || ""}
                onChange={(e) => updateField("reserve", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Taxi Burn (lbs)</Label>
              <Input
                type="number"
                value={leg.taxiFuelBurn || ""}
                onChange={(e) => updateField("taxiFuelBurn", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Weight Limits */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Max Takeoff (lbs)</Label>
              <Input
                type="number"
                value={leg.maxTakeoffWeight || ""}
                onChange={(e) => updateField("maxTakeoffWeight", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Max Landing (lbs)</Label>
              <Input
                type="number"
                value={leg.maxLandingWeight || ""}
                onChange={(e) => updateField("maxLandingWeight", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Max Ramp (lbs)</Label>
              <Input
                type="number"
                value={leg.maxRampWeight || ""}
                onChange={(e) => updateField("maxRampWeight", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </CardContent>
      )}

      {/* Confirmed summary */}
      {isConfirmed && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            {leg.departure} → {leg.destination}
            {leg.departureFuelPrices[0]?.price > 0 && ` | $${leg.departureFuelPrices[0].price}/gal`}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// --- Main Page ---
export default function TripLegsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tripForm, setTripForm] = useState<TripFormData | null>(null);
  const [aircraft, setAircraft] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addLegOpen, setAddLegOpen] = useState(false);

  // Load trip + aircraft data
  useEffect(() => {
    async function load() {
      if (!tripId) return;
      const { data: tripData, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", parseInt(tripId))
        .single();

      if (error || !tripData) {
        toast({ title: "Error", description: "Could not load trip", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      const itinerary = tripData.itinerary_details as unknown as TripFormData | null;
      if (itinerary && itinerary.legs && itinerary.legs.length > 0) {
        setTripForm(itinerary);
      } else {
        // Fresh trip — create with one empty leg
        setTripForm({
          itineraryNum: tripData.itinerary_num || "",
          startingFuel: 0,
          aircraftId: "",
          basicEmptyWeight: 0,
          maxFuelReserve: 0,
          penalty: 0,
          lbsPerHour: 0,
          legs: [emptyLeg(1)],
        });
      }

      // Load aircraft if we have one
      if (itinerary?.aircraftId) {
        const { data: acData } = await supabase
          .from("aircrafts")
          .select("*")
          .eq("tail_number", itinerary.aircraftId)
          .eq("is_enabled", true)
          .single();
        if (acData) setAircraft(acData);
      }

      setLoading(false);
    }
    load();
  }, [tripId]);

  const aircraftDefaults = {
    reserve: (aircraft as Record<string, number>)?.preferred_reserve ?? 0,
    taxiFuelBurn: (aircraft as Record<string, number>)?.taxi_fuel_burn ?? 0,
    maxTakeoff: (aircraft as Record<string, number>)?.max_takeoff_weight ?? 0,
    maxLanding: (aircraft as Record<string, number>)?.max_landing_weight ?? 0,
    maxRamp: (aircraft as Record<string, number>)?.max_ramp_weight ?? 0,
    defaultPaxWeight: (aircraft as Record<string, number>)?.default_pax_weight ?? 180,
    defaultBaggageWithPax: (aircraft as Record<string, number>)?.default_baggage_with_pax ?? 0,
    defaultBaggageNoPax: (aircraft as Record<string, number>)?.default_baggage_no_pax ?? 0,
    defaultPicWeight: (aircraft as Record<string, number>)?.default_pic_weight ?? 180,
    defaultSicWeight: (aircraft as Record<string, number>)?.default_sic_weight ?? 180,
    defaultCabinWeight: (aircraft as Record<string, number>)?.default_cabin_weight ?? 0,
    maxFuelCapacity: (aircraft as Record<string, number>)?.max_fuel_capacity ?? 0,
    basicEmptyWeight: (aircraft as Record<string, number>)?.basic_empty_weight ?? 0,
    penaltyRate: (aircraft as Record<string, number>)?.penalty_rate ?? 0,
    cruiseFuelBurn: (aircraft as Record<string, number>)?.cruise_fuel_burn ?? 0,
  };

  // --- PDF Upload Handler ---
  const handlePdfUpload = async (file: File) => {
    if (!tripForm) return;
    console.log("File selected:", file.name);
    setParsing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      console.log("Sending to API:", `${API_URL}/api/parse-itinerary`);
      const response = await fetch(`${API_URL}/api/parse-itinerary`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error("API error response:", errBody);
        throw new Error(`Parse failed (${response.status}): ${errBody}`);
      }

      const parsed = await response.json();
      console.log("Parse response:", parsed);

      if (parsed.errors && parsed.errors.length > 0) {
        toast({
          title: "Parse warnings",
          description: parsed.errors[0],
          variant: "destructive",
        });
      }

      // Convert to form legs with aircraft defaults
      const newLegs = parsedLegsToFormData(parsed, {
        defaultPaxWeight: aircraftDefaults.defaultPaxWeight,
        defaultBaggageWithPax: aircraftDefaults.defaultBaggageWithPax,
        defaultBaggageNoPax: aircraftDefaults.defaultBaggageNoPax,
        defaultPicWeight: aircraftDefaults.defaultPicWeight,
        defaultSicWeight: aircraftDefaults.defaultSicWeight,
        defaultCabinWeight: aircraftDefaults.defaultCabinWeight,
        preferredReserve: aircraftDefaults.reserve,
        taxiFuelBurn: aircraftDefaults.taxiFuelBurn,
        maxTakeoffWeight: aircraftDefaults.maxTakeoff,
        maxLandingWeight: aircraftDefaults.maxLanding,
        maxRampWeight: aircraftDefaults.maxRamp,
        maxFuelCapacity: aircraftDefaults.maxFuelCapacity,
      });

      setTripForm({
        ...tripForm,
        itineraryNum: parsed.itinerary_num || tripForm.itineraryNum,
        aircraftId: parsed.aircraft || tripForm.aircraftId,
        legs: newLegs,
      });

      if (parsed.aircraft) {
        const { data: acData } = await supabase
          .from("aircrafts")
          .select("*")
          .eq("tail_number", parsed.aircraft)
          .eq("is_enabled", true)
          .single();
        if (acData) setAircraft(acData);
      }

      toast({ title: "Itinerary parsed", description: `Found ${newLegs.length} leg(s)` });
    } catch (err) {
      console.error("Parse error:", err);
      const message = err instanceof Error ? err.message : "Failed to parse itinerary";
      toast({ title: "Parse error", description: message, variant: "destructive" });
    } finally {
      setParsing(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- Leg management ---
  const updateLeg = (index: number, updated: LegFormData) => {
    if (!tripForm) return;
    const legs = [...tripForm.legs];
    legs[index] = updated;
    setTripForm({ ...tripForm, legs });
  };

  const addLeg = () => {
    if (!tripForm) return;
    const nextNum = Math.max(...tripForm.legs.map((l) => l.legNum), 0) + 1;
    setTripForm({ ...tripForm, legs: [...tripForm.legs, emptyLeg(nextNum)] });
    setAddLegOpen(false);
  };

  const removeLeg = (index: number) => {
    if (!tripForm || tripForm.legs.length <= 1) return;
    setTripForm({ ...tripForm, legs: tripForm.legs.filter((_, i) => i !== index) });
  };

  // --- Save & Navigate ---
  const handleNext = async () => {
    if (!tripForm || !tripId) return;
    setSaving(true);

    // Apply aircraft data to trip form
    const updatedForm: TripFormData = {
      ...tripForm,
      basicEmptyWeight: aircraftDefaults.basicEmptyWeight,
      maxFuelReserve: aircraftDefaults.maxFuelCapacity,
      penalty: aircraftDefaults.penaltyRate,
      lbsPerHour: aircraftDefaults.cruiseFuelBurn,
    };

    const { error } = await supabase
      .from("trips")
      .update({
        itinerary_details: updatedForm as unknown as import('@/integrations/supabase/types').Json,
        itinerary_num: updatedForm.itineraryNum,
      })
      .eq("id", parseInt(tripId));

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: "Failed to save legs", variant: "destructive" });
      return;
    }

    navigate(`/trips/${tripId}/fuel`);
  };

  const allConfirmed = tripForm?.legs.every((l) => l.isConfirmed) ?? false;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tripForm) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Trip Legs</h1>
      </div>

      {/* PDF Upload */}
      <Card className="border-dashed border-2">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Upload Itinerary (PDF)</p>
              <p className="text-xs text-muted-foreground">AI will parse your trip sheet and fill in the legs</p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfUpload(file);
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing}
              >
                {parsing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Parsing...</>
                ) : (
                  <><FileUp className="h-4 w-4 mr-2" /> Upload PDF</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leg Editors */}
      <div className="space-y-3">
        {tripForm.legs.map((leg, index) => (
          <LegEditor
            key={`${leg.legNum}-${index}`}
            leg={leg}
            onUpdate={(updated) => updateLeg(index, updated)}
            onConfirm={() => updateLeg(index, { ...leg, isConfirmed: true })}
            onUnconfirm={() => updateLeg(index, { ...leg, isConfirmed: false })}
            onRemove={() => removeLeg(index)}
            aircraftDefaults={aircraftDefaults}
          />
        ))}
      </div>

      {/* Add Leg */}
      <Dialog open={addLegOpen} onOpenChange={setAddLegOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" /> Add Leg
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Leg</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button onClick={addLeg} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Blank Leg
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setAddLegOpen(false);
                fileInputRef.current?.click();
              }}
            >
              <FileUp className="h-4 w-4 mr-2" /> Upload Additional Itinerary
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Next Button */}
      <div className="flex gap-3 pt-2">
        <Button
          onClick={handleNext}
          disabled={!allConfirmed || saving || tripForm.legs.length === 0}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4 mr-2" />
          )}
          Next: Fuel Burns
        </Button>
      </div>
    </div>
  );
}
