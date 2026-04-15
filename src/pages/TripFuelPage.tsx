// TripFuelPage — Step 2 of trip planning: enter fuel burns and run the optimizer.
// Route: /trips/:tripId/fuel

import { useState, useEffect, useMemo } from "react";
import ParsingLoader from "@/components/ParsingLoader";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formToTripInput, runFuelOptimization, resultToSummary } from "@/lib/fuel-service";
import type { TripFormData, TripSummary } from "@/types/trip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Plane, AlertTriangle, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ItineraryViewer from "@/components/ItineraryViewer";

const GALS_TO_LBS = 6.7;

interface LegValidation {
  errors: string[];
  warnings: string[];
}

function validateLeg(
  leg: TripFormData["legs"][0],
  fuelBurn: number,
  startingFuel: number,
  isFirstLeg: boolean,
  maxFuelCapacity: number,
  basicEmptyWeight: number,
): LegValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (fuelBurn <= 0) return { errors, warnings };

  // Parse weights
  const paxWeights = leg.passengerWeights
    .split(",")
    .map((w) => parseFloat(w.trim()))
    .filter((w) => !isNaN(w));
  const crewWeights = leg.crewWeight
    .split(",")
    .map((w) => parseFloat(w.trim()))
    .filter((w) => !isNaN(w));

  const paxTotal = paxWeights.reduce((s, w) => s + w, 0);
  const crewTotal = crewWeights.reduce((s, w) => s + w, 0);
  const fixedWeights = basicEmptyWeight + leg.baggage + crewTotal + paxTotal;

  // Max fuel the tank can physically hold
  const maxFuelLbs = maxFuelCapacity;

  // Weight-limited fuel capacity for takeoff
  const maxFuelForTakeoff = leg.maxTakeoffWeight - fixedWeights;
  const maxFuelForLanding = leg.maxLandingWeight - fixedWeights;
  const maxFuelForRamp = leg.maxRampWeight - fixedWeights;

  // Check: fuel burn + reserve exceeds what the aircraft can carry
  const minRequiredFuel = fuelBurn + leg.reserve + leg.taxiFuelBurn;
  const effectiveTakeoffCap = Math.min(maxFuelForTakeoff, maxFuelLbs);

  if (minRequiredFuel > effectiveTakeoffCap) {
    errors.push(
      `Fuel burn (${fuelBurn}) + reserve (${leg.reserve}) + taxi (${leg.taxiFuelBurn}) = ${minRequiredFuel} lbs exceeds max takeoff fuel capacity of ${Math.floor(effectiveTakeoffCap)} lbs`
    );
  }

  // Check: landing fuel would exceed max landing weight
  if (maxFuelForLanding < leg.reserve) {
    errors.push(
      `Reserve fuel (${leg.reserve} lbs) alone exceeds max landing fuel capacity of ${Math.floor(maxFuelForLanding)} lbs`
    );
  }

  // Check: ramp weight
  if (maxFuelForRamp < minRequiredFuel) {
    errors.push(
      `Required fuel (${minRequiredFuel} lbs) exceeds max ramp fuel capacity of ${Math.floor(maxFuelForRamp)} lbs`
    );
  }

  // Check: fixed weights alone exceed limits
  if (fixedWeights > leg.maxTakeoffWeight) {
    errors.push(
      `Fixed weights (${Math.floor(fixedWeights)} lbs) exceed max takeoff weight (${leg.maxTakeoffWeight} lbs) — no fuel can be added`
    );
  }

  if (fixedWeights > leg.maxLandingWeight) {
    errors.push(
      `Fixed weights (${Math.floor(fixedWeights)} lbs) exceed max landing weight (${leg.maxLandingWeight} lbs)`
    );
  }

  // Warning: fuel burn is very high relative to capacity
  if (fuelBurn > maxFuelLbs * 0.9) {
    warnings.push(`Fuel burn (${fuelBurn} lbs) is over 90% of max fuel capacity (${maxFuelLbs} lbs)`);
  }

  return { errors, warnings };
}

export default function TripFuelPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tripForm, setTripForm] = useState<TripFormData | null>(null);
  const [startingFuel, setStartingFuel] = useState(0);
  const [fuelBurns, setFuelBurns] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    async function loadTrip() {
      if (!tripId) return;
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", parseInt(tripId))
        .single();

      if (error || !data) {
        toast({ title: "Error", description: "Could not load trip data", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      const itinerary = data.itinerary_details as unknown as TripFormData;
      if (!itinerary?.legs || itinerary.legs.length === 0) {
        toast({ title: "Error", description: "No legs found — go back and add legs first", variant: "destructive" });
        navigate(`/trips/${tripId}/legs`);
        return;
      }

      setTripForm(itinerary);
      setStartingFuel(itinerary.startingFuel || 0);
      setFuelBurns(itinerary.legs.map((l) => l.fuelBurn || 0));
      setLoading(false);
    }
    loadTrip();
  }, [tripId]);

  const confirmedLegsWithIndex = useMemo(() => {
    if (!tripForm) return [];
    return tripForm.legs
      .map((leg, originalIndex) => ({ leg, originalIndex }))
      .filter(({ leg }) => leg.isConfirmed && leg.legNum > 0);
  }, [tripForm]);

  // Validate all legs
  const validations = useMemo(() => {
    if (!tripForm) return [];
    return tripForm.legs.map((leg, i) =>
      validateLeg(
        leg,
        fuelBurns[i] ?? 0,
        startingFuel,
        i === 0,
        tripForm.maxFuelReserve,
        tripForm.basicEmptyWeight,
      )
    );
  }, [tripForm, fuelBurns, startingFuel]);

  const hasErrors = validations.some((v) => v.errors.length > 0);

  const handleFuelBurnChange = (index: number, value: number) => {
    setFuelBurns((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleOptimize = async () => {
    if (!tripForm || !tripId) return;

    const updatedForm: TripFormData = {
      ...tripForm,
      startingFuel,
      legs: tripForm.legs.map((leg, i) => ({
        ...leg,
        fuelBurn: fuelBurns[i] ?? 0,
      })),
    };

    setOptimizing(true);

    try {
      const tripInput = formToTripInput(updatedForm);
      const result = await runFuelOptimization(tripInput);
      const summary: TripSummary = resultToSummary(result, tripInput, parseInt(tripId));

      const { error } = await supabase
        .from("trips")
        .update({
          details: summary as unknown as import("@/integrations/supabase/types").Json,
          itinerary_details: updatedForm as unknown as import("@/integrations/supabase/types").Json,
          savings: summary.savings,
        })
        .eq("id", parseInt(tripId));

      if (error) throw error;

      toast({ title: "Optimization complete", description: `Potential savings: $${summary.savings.toFixed(2)}` });
      navigate(`/trips/${tripId}/summary`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Optimization failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setOptimizing(false);
    }
  };

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
      {optimizing && <ParsingLoader title="Optimizing fuel plan…" subtitle="Finding the cheapest fueling strategy" />}
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 px-3 sm:p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/trips/${tripId}/legs`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold flex-1">Fuel Details</h1>
          {tripId && <ItineraryViewer tripId={tripId} />}
        </div>

        {/* Starting Fuel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Fuel on Board</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={startingFuel || ""}
                onChange={(e) => setStartingFuel(parseFloat(e.target.value) || 0)}
                placeholder="Fuel in lbs"
                className="max-w-[200px]"
              />
              <span className="text-sm text-muted-foreground">lbs</span>
            </div>
          </CardContent>
        </Card>

        {/* Per-Leg Fuel Burns */}
        <h2 className="text-lg font-semibold text-muted-foreground">Enter fuel burns for each leg</h2>
        <div className="space-y-3">
          {confirmedLegsWithIndex.map(({ leg, originalIndex }) => {
            const v = validations[originalIndex];
            const hasLegErrors = v && v.errors.length > 0;
            const hasLegWarnings = v && v.warnings.length > 0;

            return (
              <Card key={leg.legNum} className={hasLegErrors ? "border-destructive" : ""}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Plane className="h-4 w-4 text-muted-foreground" />
                      <Label className="font-medium">
                        Leg {leg.legNum}: {leg.departure} → {leg.destination}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={fuelBurns[originalIndex] || ""}
                        onChange={(e) => handleFuelBurnChange(originalIndex, parseFloat(e.target.value) || 0)}
                        placeholder="Fuel burn (lbs)"
                        className={`max-w-[160px] ${hasLegErrors ? "border-destructive" : ""}`}
                      />
                      <span className="text-sm text-muted-foreground">lbs</span>
                    </div>
                  </div>

                  {/* Leg breakdown */}
                  {(() => {
                    const paxWeights = leg.passengerWeights
                      .split(",").map((w) => parseFloat(w.trim())).filter((w) => !isNaN(w));
                    const crewWeights = leg.crewWeight
                      .split(",").map((w) => parseFloat(w.trim())).filter((w) => !isNaN(w));
                    const paxTotal = paxWeights.reduce((s, w) => s + w, 0);
                    const crewTotal = crewWeights.reduce((s, w) => s + w, 0);
                    const fixedWt = tripForm.basicEmptyWeight + leg.baggage + crewTotal + paxTotal;

                    const maxFuelTakeoff = Math.min(leg.maxTakeoffWeight - fixedWt, tripForm.maxFuelReserve);
                    const maxFuelLanding = Math.min(leg.maxLandingWeight - fixedWt, tripForm.maxFuelReserve);
                    const maxFuelRamp = Math.min(leg.maxRampWeight - fixedWt, tripForm.maxFuelReserve);
                    const maxFuelAllowed = Math.min(maxFuelTakeoff, maxFuelRamp);
                    const burn = fuelBurns[originalIndex] ?? 0;
                    const minFuelRequired = burn + leg.reserve + leg.taxiFuelBurn;

                    return (
                      <div className="mt-2 space-y-2">
                        {/* Row 1: Reserve & bounds */}
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span>Reserve: <span className="text-foreground font-medium">{leg.reserve.toLocaleString()} lbs</span></span>
                          <span>Min Fuel Required: <span className="text-foreground font-medium">{Math.max(0, Math.floor(minFuelRequired)).toLocaleString()} lbs</span></span>
                          <span>Max Fuel Allowed: <span className={`font-medium ${maxFuelAllowed < 0 ? "text-destructive" : "text-foreground"}`}>{Math.floor(maxFuelAllowed).toLocaleString()} lbs</span></span>
                        </div>
                        {/* Row 2: Weight limits with available fuel capacity */}
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span>Fixed Wt: {Math.floor(fixedWt).toLocaleString()} lbs</span>
                          <span>TO Limit: {leg.maxTakeoffWeight.toLocaleString()} lbs ({Math.floor(maxFuelTakeoff).toLocaleString()} avail)</span>
                          <span>LDG Limit: {leg.maxLandingWeight.toLocaleString()} lbs ({Math.floor(maxFuelLanding).toLocaleString()} avail)</span>
                          <span>Ramp Limit: {leg.maxRampWeight.toLocaleString()} lbs ({Math.floor(maxFuelRamp).toLocaleString()} avail)</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Errors */}
                  {hasLegErrors && (
                    <div className="space-y-1">
                      {v.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-destructive">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {hasLegWarnings && !hasLegErrors && (
                    <div className="space-y-1">
                      {v.warnings.map((warn, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-yellow-500">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => navigate(`/trips/${tripId}/legs`)}
            className="flex-1"
          >
            Back to Legs
          </Button>
          <Button
            onClick={handleOptimize}
            disabled={optimizing || fuelBurns.some((b) => b <= 0) || hasErrors}
            className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
          >
            {optimizing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Optimizing...
              </>
            ) : (
              "Confirm Trip"
            )}
          </Button>
        </div>

        {hasErrors && (
          <p className="text-sm text-destructive text-center">
            Fix the weight/fuel errors above before optimizing
          </p>
        )}
      </div>
    </>
  );
}
