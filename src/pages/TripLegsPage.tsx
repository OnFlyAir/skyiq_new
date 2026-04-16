// TripLegsPage — Step 1 of trip planning: configure each leg of the trip.
// Route: /trips/:tripId/legs
// Supports PDF upload (AI parsing), manual entry, and per-leg editing.
// Each leg has: departure/destination, fuel prices (tiered), fees, crew, pax, weights.

import { useState, useEffect, useRef, useCallback, createRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { parsedLegsToFormData } from "@/lib/itinerary-service";
import { pendingParseFile } from "@/lib/pending-parse-file";
import ParsingLoader from "@/components/ParsingLoader";
import type { TripFormData, LegFormData, FuelTier } from "@/types/trip";
import type { Aircraft } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import ItineraryViewer from "@/components/ItineraryViewer";
import { useDemo } from "@/contexts/DemoContext";
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
                data-demo="verify-leg-btn"
                size="sm"
                onClick={onConfirm}
                disabled={!leg.departure || !leg.destination}
                className="bg-green-600 hover:bg-green-700 text-xs"
              >
                <Check className="h-3 w-3 mr-1" /> Leg Info Correct
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onUnconfirm} className="text-xs">
                Edit
              </Button>
            )}
            <Button data-demo="delete-leg-btn" size="sm" variant="ghost" onClick={onRemove} className="text-red-500 hover:text-red-700">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isConfirmed && (
        <CardContent className="space-y-4">
          {/* Route */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div data-demo={`leg-${leg.legNum}-departure`}>
              <Label className="text-xs">Departure (ICAO)</Label>
              <Input
                value={leg.departure}
                onChange={(e) => updateField("departure", e.target.value.toUpperCase())}
                placeholder="KJFK"
                maxLength={4}
              />
            </div>
            <div data-demo={`leg-${leg.legNum}-destination`}>
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
          <div data-demo={`leg-${leg.legNum}-fuel-price`}>
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

          <div data-demo={`leg-${leg.legNum}-fees`} className="grid grid-cols-3 gap-2 sm:gap-3">
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
          <div className="grid grid-cols-2 gap-2 sm:gap-3 items-end">
            <div>
              <Label className="text-xs flex items-center gap-1 mb-1">
                Crew Weights
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent><p className="text-xs">PIC, SIC, Flight Attendant</p></TooltipContent>
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
              <Label className="text-xs mb-1 block">Passenger Weights</Label>
              <Input
                value={leg.passengerWeights}
                onChange={(e) => updateField("passengerWeights", e.target.value)}
                placeholder="180, 200"
              />
            </div>
          </div>

          {/* Baggage */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
            {leg.departureFuelPrices[0]?.price > 0 && ` | $${leg.departureFuelPrices[0].price.toFixed(2)}/gal`}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// --- Helper to extract defaults from an Aircraft record ---
function getAircraftDefaults(ac: Aircraft | null) {
  return {
    reserve: ac?.preferred_reserve ?? 0,
    taxiFuelBurn: ac?.taxi_fuel_burn ?? 0,
    maxTakeoff: ac?.max_takeoff_weight ?? 0,
    maxLanding: ac?.max_landing_weight ?? 0,
    maxRamp: ac?.max_ramp_weight ?? 0,
    defaultPaxWeight: ac?.default_pax_weight ?? 180,
    defaultBaggageWithPax: ac?.default_baggage_with_pax ?? 0,
    defaultBaggageNoPax: ac?.default_baggage_no_pax ?? 0,
    defaultPicWeight: ac?.default_pic_weight ?? 180,
    defaultSicWeight: ac?.default_sic_weight ?? 180,
    defaultCabinWeight: ac?.default_cabin_weight ?? 0,
    maxFuelCapacity: ac?.max_fuel_capacity ?? 0,
    basicEmptyWeight: ac?.basic_empty_weight ?? 0,
    penaltyRate: ac?.penalty_rate ?? 0,
    cruiseFuelBurn: ac?.cruise_fuel_burn ?? 0,
  };
}

// --- Main Page ---
export default function TripLegsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuthContext();
  const { active: demoActive, currentStep, nextStep } = useDemo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoParseTriggered = useRef(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [tripForm, setTripForm] = useState<TripFormData | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addLegOpen, setAddLegOpen] = useState(false);
  const appendModeRef = useRef(false);

  // Load trip + aircraft data + fleet list
  useEffect(() => {
    async function load() {
      if (!tripId || !user) return;

      // Load fleet list and trip in parallel
      const [tripRes, fleetRes] = await Promise.all([
        supabase.from("trips").select("*").eq("id", parseInt(tripId)).single(),
        supabase.from("aircrafts").select("*").eq("user_company", user.id).eq("is_enabled", true).order("tail_number"),
      ]);

      if (tripRes.error || !tripRes.data) {
        toast({ title: "Error", description: "Could not load trip", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      let fleet = (fleetRes.data ?? []) as unknown as Aircraft[];

      // In demo mode, inject mock NSKYIQ aircraft if not already in fleet
      if (demoActive && !fleet.some((ac) => ac.tail_number === "NSKYIQ")) {
        const demoAircraft: Aircraft = {
          id: 99999,
          tail_number: "NSKYIQ",
          manufacturer: "Cessna / Textron",
          type: "Citation CJ3 (C525B)",
          user_company: user.id,
          is_enabled: true,
          basic_empty_weight: 8300,
          max_takeoff_weight: 13870,
          max_landing_weight: 12750,
          max_ramp_weight: 14070,
          max_fuel_capacity: 4710,
          preferred_reserve: 780,
          taxi_fuel_burn: 48,
          cruise_fuel_burn: 1040,
          penalty_rate: 0.038,
          carry_type_id: null,
          default_pax_weight: 180,
          default_baggage_with_pax: 30,
          default_baggage_no_pax: 0,
          default_pic_weight: 180,
          default_sic_weight: 180,
          default_cabin_weight: 0,
        };
        fleet = [demoAircraft, ...fleet];
      }

      setAircraftList(fleet);

      const itinerary = tripRes.data.itinerary_details as unknown as TripFormData | null;
      if (itinerary && itinerary.legs && itinerary.legs.length > 0) {
        setTripForm(itinerary);
      } else {
        setTripForm({
          itineraryNum: tripRes.data.itinerary_num || "",
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
        const match = (fleetRes.data ?? []).find(
          (ac: any) => ac.tail_number === itinerary.aircraftId
        );
        if (match) setAircraft(match as unknown as Aircraft);
      }

      setLoading(false);
    }
    load();
  }, [tripId, user]);

  const aircraftDefaults = getAircraftDefaults(aircraft);

  const scrollToLeg = useCallback((legIndex: number) => {
    const el = document.getElementById(`leg-${legIndex}`);
    if (!el) return;

    const progressBottom = progressBarRef.current?.getBoundingClientRect().bottom ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - progressBottom - 12;

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: "smooth",
    });
  }, []);

  // --- Switch aircraft handler ---
  const handleAircraftChange = async (tailNumber: string) => {
    if (!tripForm) return;
    const match = aircraftList.find((ac) => ac.tail_number === tailNumber);
    if (!match) return;
    setAircraft(match);
    const defs = getAircraftDefaults(match);

    // Update all legs with new aircraft defaults
    const updatedLegs = tripForm.legs.map((leg) => ({
      ...leg,
      baggage: leg.passengerWeights !== "0" && leg.passengerWeights !== ""
        ? defs.defaultBaggageWithPax
        : defs.defaultBaggageNoPax,
      reserve: defs.reserve,
      taxiFuelBurn: defs.taxiFuelBurn,
      maxTakeoffWeight: defs.maxTakeoff,
      maxLandingWeight: defs.maxLanding,
      maxRampWeight: defs.maxRamp,
      crewWeight: `${defs.defaultPicWeight}, ${defs.defaultSicWeight}, ${defs.defaultCabinWeight}`,
    }));

    setTripForm({
      ...tripForm,
      aircraftId: tailNumber,
      legs: updatedLegs,
    });
  };

  // Auto-parse PDF if navigated from NewTripPage with a pending file
  useEffect(() => {
    const file = pendingParseFile.current;
    if (file && tripForm && !autoParseTriggered.current) {
      autoParseTriggered.current = true;
      pendingParseFile.current = null;
      handlePdfUpload(file, false);
    }
  }, [tripForm]);

  // Demo: auto-advance from wait-for-parse step when parsing finishes
  const wasParsing = useRef(false);
  useEffect(() => {
    if (parsing) {
      wasParsing.current = true;
    } else if (wasParsing.current && demoActive && currentStep?.id === 'wait-for-parse') {
      wasParsing.current = false;
      setTimeout(() => nextStep(), 400);
    }
  }, [parsing, demoActive, currentStep, nextStep]);

  // --- PDF Upload Handler ---
  const handlePdfUpload = async (file: File, appendMode = false) => {
    if (!tripForm) return;
    console.log("File selected:", file.name);
    setParsing(true);

    try {
      // Convert PDF to base64 for proper binary handling
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-itinerary`;
      console.log("Sending to edge function:", edgeFnUrl);
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(edgeFnUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pdf_base64: base64, filename: file.name, trip_id: tripId ? parseInt(tripId) : undefined }),
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

      // Use itinerary_num from parsed sheet as trip ID
      const parsedItineraryNum = parsed.itinerary_num || tripForm.itineraryNum;

      // In append mode, keep existing legs and add new ones with renumbered leg numbers
      const existingLegs = appendMode ? tripForm.legs : [];
      const maxLegNum = existingLegs.length > 0 ? Math.max(...existingLegs.map((l) => l.legNum)) : 0;
      const renumberedNewLegs = newLegs.map((leg, i) => ({
        ...leg,
        legNum: maxLegNum + i + 1,
      }));
      const combinedLegs = [...existingLegs, ...renumberedNewLegs];

      setTripForm({
        ...tripForm,
        itineraryNum: appendMode ? tripForm.itineraryNum : parsedItineraryNum,
        aircraftId: parsed.aircraft || tripForm.aircraftId,
        legs: combinedLegs,
      });

      // Match aircraft from parsed tail number
      if (parsed.aircraft) {
        const parsedTail = parsed.aircraft.replace(/[-\s]/g, "").toUpperCase();
        console.log("Parsed tail number:", parsed.aircraft, "→ normalized:", parsedTail);
        console.log("Available aircraft:", aircraftList.map((ac) => ac.tail_number));
        
        const match = aircraftList.find((ac) => {
          const storedTail = ac.tail_number.replace(/[-\s]/g, "").toUpperCase();
          return storedTail === parsedTail || storedTail.includes(parsedTail) || parsedTail.includes(storedTail);
        });
        
        if (match) {
          console.log("Matched aircraft:", match.tail_number);
          setAircraft(match);
          // Re-apply defaults from matched aircraft
          const defs = getAircraftDefaults(match);
          const refilledNewLegs = renumberedNewLegs.map((leg) => {
            const paxValues = leg.passengerWeights.split(",").map((w) => parseFloat(w.trim())).filter((w) => !isNaN(w));
            const hasPax = paxValues.length > 0 && paxValues.some((w) => w > 0);
            return {
              ...leg,
              baggage: hasPax ? defs.defaultBaggageWithPax : defs.defaultBaggageNoPax,
              reserve: defs.reserve,
              taxiFuelBurn: defs.taxiFuelBurn,
              maxTakeoffWeight: defs.maxTakeoff,
              maxLandingWeight: defs.maxLanding,
              maxRampWeight: defs.maxRamp,
              crewWeight: `${defs.defaultPicWeight}, ${defs.defaultSicWeight}, ${defs.defaultCabinWeight}`,
            };
          });
          setTripForm((prev) =>
            prev
              ? { ...prev, aircraftId: match.tail_number, itineraryNum: appendMode ? prev.itineraryNum : parsedItineraryNum, legs: [...existingLegs, ...refilledNewLegs] }
              : prev
          );
        } else {
          // No exact match — if user has only one aircraft, auto-select it
          if (aircraftList.length === 1) {
            const fallback = aircraftList[0];
            console.log("No match for parsed tail, auto-selecting only aircraft:", fallback.tail_number);
            setAircraft(fallback as unknown as Aircraft);
            const defs = getAircraftDefaults(fallback as unknown as Aircraft);
            const refilledNewLegs = renumberedNewLegs.map((leg) => {
              const paxValues = leg.passengerWeights.split(",").map((w) => parseFloat(w.trim())).filter((w) => !isNaN(w));
              const hasPax = paxValues.length > 0 && paxValues.some((w) => w > 0);
              return {
                ...leg,
                baggage: hasPax ? defs.defaultBaggageWithPax : defs.defaultBaggageNoPax,
                reserve: defs.reserve,
                taxiFuelBurn: defs.taxiFuelBurn,
                maxTakeoffWeight: defs.maxTakeoff,
                maxLandingWeight: defs.maxLanding,
                maxRampWeight: defs.maxRamp,
                crewWeight: `${defs.defaultPicWeight}, ${defs.defaultSicWeight}, ${defs.defaultCabinWeight}`,
              };
            });
            setTripForm((prev) =>
              prev
                ? { ...prev, aircraftId: fallback.tail_number, itineraryNum: appendMode ? prev.itineraryNum : parsedItineraryNum, legs: [...existingLegs, ...refilledNewLegs] }
                : prev
            );
            toast({ title: "Aircraft auto-selected", description: `Using ${fallback.tail_number} (PDF had "${parsed.aircraft}")` });
          } else {
            console.warn("No matching aircraft found for parsed tail:", parsed.aircraft);
            toast({
              title: "Aircraft not found",
              description: `Tail "${parsed.aircraft}" not in your fleet. Please select manually.`,
            });
          }
        }
      } else if (!parsed.aircraft && aircraftList.length === 1 && !aircraft) {
        // No tail in PDF but user has one aircraft — auto-select it
        const fallback = aircraftList[0];
        setAircraft(fallback as unknown as Aircraft);
        const defs = getAircraftDefaults(fallback as unknown as Aircraft);
        const refilledNewLegs = renumberedNewLegs.map((leg) => {
          const paxValues = leg.passengerWeights.split(",").map((w) => parseFloat(w.trim())).filter((w) => !isNaN(w));
          const hasPax = paxValues.length > 0 && paxValues.some((w) => w > 0);
          return {
            ...leg,
            baggage: hasPax ? defs.defaultBaggageWithPax : defs.defaultBaggageNoPax,
            reserve: defs.reserve,
            taxiFuelBurn: defs.taxiFuelBurn,
            maxTakeoffWeight: defs.maxTakeoff,
            maxLandingWeight: defs.maxLanding,
            maxRampWeight: defs.maxRamp,
            crewWeight: `${defs.defaultPicWeight}, ${defs.defaultSicWeight}, ${defs.defaultCabinWeight}`,
          };
        });
        setTripForm((prev) =>
          prev
            ? { ...prev, aircraftId: fallback.tail_number, legs: [...existingLegs, ...refilledNewLegs] }
            : prev
        );
      }

      toast({ title: "Itinerary parsed", description: `Found ${newLegs.length} leg(s) — Trip ${parsedItineraryNum}` });
    } catch (err) {
      console.error("Parse error:", err);

      // In demo mode, inject mock parsed data so the demo continues smoothly
      if (demoActive) {
        console.log("Demo mode: injecting mock parsed data after parse failure");
        const demoAc = aircraftList.find((ac) => ac.tail_number === "NSKYIQ");
        const defs = demoAc ? getAircraftDefaults(demoAc) : aircraftDefaults;
        const mockLegs: LegFormData[] = [
          {
            legNum: 1,
            departure: "KJFK",
            destination: "KLAX",
            departureFuelPrices: [{ min_fuel: 0, price: 6.25 }],
            waivedFee: { name: "", amount: 0, isWaivable: false, waivedAt: 0, airport: "" },
            passengerWeights: "180, 200",
            baggage: defs.defaultBaggageWithPax,
            crewWeight: `${defs.defaultPicWeight}, ${defs.defaultSicWeight}, ${defs.defaultCabinWeight}`,
            fuelBurn: 0,
            reserve: defs.reserve,
            taxiFuelBurn: defs.taxiFuelBurn,
            maxTakeoffWeight: defs.maxTakeoff,
            maxLandingWeight: defs.maxLanding,
            maxRampWeight: defs.maxRamp,
            isConfirmed: false,
          },
        ];
        if (demoAc) setAircraft(demoAc);
        setTripForm((prev) =>
          prev
            ? {
                ...prev,
                itineraryNum: "21SKYIQ",
                aircraftId: demoAc?.tail_number ?? prev.aircraftId,
                legs: mockLegs,
              }
            : prev
        );
        toast({ title: "Itinerary parsed", description: "Found 1 leg(s) — Trip 21SKYIQ" });
      } else {
        const message = err instanceof Error ? err.message : "Failed to parse itinerary";
        toast({ title: "Parse error", description: message, variant: "destructive" });
      }
    } finally {
      setParsing(false);
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

  const confirmedCount = tripForm?.legs.filter((l) => l.isConfirmed).length ?? 0;
  const totalLegs = tripForm?.legs.length ?? 0;
  const allConfirmed = confirmedCount === totalLegs && totalLegs > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tripForm) return null;

  return (
    <>
    {parsing && <ParsingLoader />}
    <div className="max-w-2xl mx-auto space-y-4 px-3 sm:p-4">
      {/* Header with Trip ID */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Trip Legs</h1>
          {tripForm.itineraryNum && (
            <p className="text-sm text-muted-foreground truncate">Trip: {tripForm.itineraryNum}</p>
          )}
        </div>
        {tripId && <ItineraryViewer tripId={tripId} />}
      </div>

      {/* Aircraft Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Aircraft</Label>
              <Select
                value={tripForm.aircraftId || ""}
                onValueChange={handleAircraftChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select aircraft" />
                </SelectTrigger>
                <SelectContent>
                  {aircraftList.map((ac) => (
                    <SelectItem key={ac.id} value={ac.tail_number}>
                      {ac.tail_number} — {ac.manufacturer} {ac.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 mt-4"
              onClick={() => navigate("/fleet/add")}
            >
              <Plus className="h-4 w-4 mr-1" /> Add New
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden file input for Add Leg dialog */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePdfUpload(file, appendModeRef.current);
          appendModeRef.current = false;
        }}
      />

      {/* Sticky progress bar */}
      {totalLegs > 0 && (
        <div ref={progressBarRef} className="sticky top-0 z-40 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {allConfirmed ? "All legs verified ✓" : `Verify each leg (${confirmedCount}/${totalLegs})`}
            </span>
            <span className="text-xs text-muted-foreground">{Math.round((confirmedCount / totalLegs) * 100)}%</span>
          </div>
          <div className="h-1 rounded-full bg-secondary overflow-hidden mt-1.5">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(confirmedCount / totalLegs) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Leg Editors */}
      <div className="space-y-3">
        {tripForm.legs.map((leg, index) => (
          <div key={`${leg.legNum}-${index}`} id={`leg-${index}`}>
            <LegEditor
              leg={leg}
              onUpdate={(updated) => updateLeg(index, updated)}
              onConfirm={() => {
                updateLeg(index, { ...leg, isConfirmed: true });
                // Auto-scroll to next unconfirmed leg
                const nextUnconfirmedIdx = tripForm.legs.findIndex(
                  (l, i) => i > index && !l.isConfirmed
                );
                if (nextUnconfirmedIdx !== -1) {
                  setTimeout(() => {
                    scrollToLeg(nextUnconfirmedIdx);
                  }, 150);
                } else if (index === tripForm.legs.length - 1 || tripForm.legs.every((l, i) => i === index || l.isConfirmed)) {
                  // All confirmed — scroll to the Next button
                  setTimeout(() => {
                    document.getElementById("next-button")?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }, 150);
                }
              }}
              onUnconfirm={() => updateLeg(index, { ...leg, isConfirmed: false })}
              onRemove={() => removeLeg(index)}
              aircraftDefaults={aircraftDefaults}
            />
          </div>
        ))}
      </div>

      {/* Add Leg */}
      <Dialog open={addLegOpen} onOpenChange={setAddLegOpen}>
        <DialogTrigger asChild>
          <Button data-demo="add-leg-btn" variant="outline" className="w-full">
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
                appendModeRef.current = true;
                fileInputRef.current?.click();
              }}
            >
              <FileUp className="h-4 w-4 mr-2" /> Upload Additional Itinerary
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Next Button */}
      <div id="next-button" className="flex gap-3 pt-2">
        <Button
          data-demo="next-fuel-burns-btn"
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
    </>
  );
}
