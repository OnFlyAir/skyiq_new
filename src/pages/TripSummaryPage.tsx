// TripSummaryPage — Displays optimization results after the fuel optimizer runs.
// Route: /trips/:tripId/summary
// Shows per-leg fuel uplift, costs, weights, and total savings.
// Supports full summary and quick-reference toggle.

import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { TripSummary, TripSummaryLeg } from "@/types/trip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Mail, Edit, ToggleLeft, ToggleRight } from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatWeight(lbs: number): string {
  return `${Math.round(lbs).toLocaleString()} lbs`;
}

function LegDetail({ leg, index, quickRef }: { leg: TripSummaryLeg; index: number; quickRef: boolean }) {
  const hasErrors = leg.errors && leg.errors.length > 0;

  if (quickRef) {
    return (
      <Card className={hasErrors ? "border-red-300" : ""}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              Leg {index + 1}: {leg.departure} → {leg.arrival}
            </span>
            <div className="text-right">
              <div className="font-bold">
                Uplift: {Math.round(leg.fuelUpliftGals)} gal / {formatWeight(leg.fuelUpliftLbs)}
              </div>
              <div className="text-sm text-muted-foreground">{formatCurrency(leg.totalCost)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={hasErrors ? "border-red-300" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Leg {index + 1}: {leg.departure} → {leg.arrival}</span>
          {leg.hasWaivedFee && (
            <Badge variant="secondary" className="text-xs">
              Fee waived at {Math.round(leg.feeMin)} gal
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasErrors && (
          <div className="mb-3 space-y-1">
            {leg.errors.map((err, i) => (
              <p key={i} className="text-sm text-red-600 font-medium">{err}</p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <div>
            <span className="text-muted-foreground">Fuel to Uplift</span>
            <p className="font-bold">{Math.round(leg.fuelUpliftGals)} gal. / {formatWeight(leg.fuelUpliftLbs)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Fuel Cost</span>
            <p className="font-medium">{formatCurrency(leg.fuelCost)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Starting Fuel</span>
            <p>{formatWeight(leg.startFuel)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Fuel Burn</span>
            <p>{formatWeight(leg.fuelBurn)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Landing Fuel</span>
            <p className={leg.landingFuel < 0 ? "text-red-600 font-bold" : ""}>
              {formatWeight(leg.landingFuel)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Total Cost</span>
            <p className="font-bold">{formatCurrency(leg.totalCost)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Takeoff Weight</span>
            <p>{formatWeight(leg.takeoffWeight)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Landing Weight</span>
            <p className={leg.landingWeight < 0 ? "text-red-600 font-bold" : ""}>
              {formatWeight(leg.landingWeight)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TripSummaryPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickRef, setQuickRef] = useState(false);

  useEffect(() => {
    async function loadSummary() {
      if (!tripId) return;
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", parseInt(tripId))
        .single();

      if (error || !data) {
        toast({ title: "Error", description: "Could not load trip", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      const details = data.details as unknown as TripSummary | null;
      if (!details || !details.legs || details.legs.length === 0) {
        toast({ title: "No results", description: "Run the optimizer first", variant: "destructive" });
        navigate(`/trips/${tripId}/fuel`);
        return;
      }

      details.id = data.id;
      setSummary(details);
      setLoading(false);
    }
    loadSummary();
  }, [tripId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!summary) return null;

  const totalCost = summary.legs.reduce((sum, l) => sum + l.totalCost, 0);
  const hasErrors = summary.legs.some((l) => l.errors && l.errors.length > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Trip Summary</h1>
          <p className="text-sm text-muted-foreground">
            {summary.aircraftNumber}
            {summary.itineraryNum ? ` — Trip #${summary.itineraryNum}` : ""}
          </p>
        </div>
      </div>

      {/* Savings Banner */}
      {summary.savings > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-green-700">Estimated Savings</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(summary.savings)}</p>
          </CardContent>
        </Card>
      )}

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickRef(!quickRef)}
          className="flex items-center gap-2"
        >
          {quickRef ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          {quickRef ? "Quick Reference" : "Full Summary"}
        </Button>
        <span className="text-lg font-bold">Total: {formatCurrency(totalCost)}</span>
      </div>

      {/* Legs */}
      <div className="space-y-3">
        {summary.legs.map((leg, i) => (
          <LegDetail key={i} leg={leg} index={i} quickRef={quickRef} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4">
        <Button asChild variant="outline" className="flex-1">
          <Link to={`/trips/${tripId}/fuel`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Itinerary
          </Link>
        </Button>
        <Button
          className="flex-1 bg-[#1a3a5c] hover:bg-[#2563eb]"
          disabled={hasErrors}
          onClick={() => !hasErrors && navigate(`/trips/${tripId}/email`)}
        >
          <Mail className="mr-2 h-4 w-4" />
          Send Email
        </Button>
      </div>
    </div>
  );
}
