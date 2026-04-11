// TripFuelPage — Step 2 of trip planning: enter fuel burns and run the optimizer.
// Route: /trips/:tripId/fuel
// Loads trip data from Supabase, displays per-leg fuel burn inputs,
// calls the optimize-fuel Edge Function, stores results, and navigates to summary.

import { useState, useEffect } from "react";
import ParsingLoader from "@/components/ParsingLoader";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formToTripInput, runFuelOptimization, resultToSummary } from "@/lib/fuel-service";
import type { TripFormData, TripSummary } from "@/types/trip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Plane } from "lucide-react";

export default function TripFuelPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tripForm, setTripForm] = useState<TripFormData | null>(null);
  const [startingFuel, setStartingFuel] = useState(0);
  const [fuelBurns, setFuelBurns] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  // Load trip data from Supabase
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

  const handleFuelBurnChange = (index: number, value: number) => {
    setFuelBurns((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleOptimize = async () => {
    if (!tripForm || !tripId) return;

    // Apply fuel burns to the form data
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
      // Convert form to API input
      const tripInput = formToTripInput(updatedForm);

      // Call the optimizer Edge Function
      const result = await runFuelOptimization(tripInput);

      // Convert to summary for storage
      const summary: TripSummary = resultToSummary(
        result,
        tripInput,
        parseInt(tripId),
      );

      // Save results to Supabase
      const { error } = await supabase
        .from("trips")
        .update({
          details: summary as unknown as import('@/integrations/supabase/types').Json,
          itinerary_details: updatedForm as unknown as import('@/integrations/supabase/types').Json,
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

  // Build confirmed legs with their ORIGINAL indices into the full legs array
  const confirmedLegsWithIndex = tripForm.legs
    .map((leg, originalIndex) => ({ leg, originalIndex }))
    .filter(({ leg }) => leg.isConfirmed && leg.legNum > 0);

  return (
    <>
    {optimizing && <ParsingLoader title="Optimizing fuel plan…" subtitle="Finding the cheapest fueling strategy" />}
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/trips/${tripId}/legs`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Fuel Details</h1>
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
      <div className="space-y-3">
        {confirmedLegsWithIndex.map(({ leg, originalIndex }) => (
          <Card key={leg.legNum}>
            <CardContent className="pt-4">
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
                    className="max-w-[160px]"
                  />
                  <span className="text-sm text-muted-foreground">lbs</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
          disabled={optimizing || fuelBurns.some((b) => b <= 0)}
          className="flex-1 bg-[#1a3a5c] hover:bg-[#2563eb]"
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
    </div>
    </>
  );
}
