// TripSummaryPage — Displays optimization results after the fuel optimizer runs.
// Route: /trips/:tripId/summary
// Shows per-leg fuel uplift, costs, weights, total savings, and optimization reasoning.

import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { TripSummary, TripSummaryLeg } from "@/types/trip";
import { generateLegReasoning, generateOverallReasoning } from "@/lib/fuel-reasoning";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Loader2, Mail, Edit,
  ToggleLeft, ToggleRight, Lightbulb, ChevronDown, ChevronUp, FileText,
} from "lucide-react";
import ItineraryViewer from "@/components/ItineraryViewer";
import { formatCurrency } from "@/lib/format";

function formatWeight(lbs: number): string {
  return `${Math.round(lbs).toLocaleString()} lbs`;
}

function LegDetail({
  leg,
  index,
  quickRef,
  reasoning,
}: {
  leg: TripSummaryLeg;
  index: number;
  quickRef: boolean;
  reasoning?: { strategy: { label: string; description: string }; details: string[] };
}) {
  const hasErrors = leg.errors && leg.errors.length > 0;
  const [showReasoning, setShowReasoning] = useState(false);



  return (
    <Card data-demo={`summary-leg-${index + 1}`} className={hasErrors ? "border-destructive" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Leg {index + 1}: {leg.departure} → {leg.arrival}</span>
          {leg.hasWaivableFee && (
            <Badge variant={leg.hasWaivedFee ? "secondary" : "outline"} className="text-xs">
              {leg.hasWaivedFee
                ? `Fee waived (${Math.round(leg.feeMin)} gal min)`
                : `Fee not waived (need ${Math.round(leg.feeMin)} gal)`}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasErrors && (
          <div className="mb-3 space-y-1">
            {leg.errors.map((err, i) => (
              <p key={i} className="text-sm text-destructive font-medium">{err}</p>
            ))}
          </div>
        )}

        {/* Strategy & Reasoning — shown first */}
        {reasoning && (
          <div className="mb-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-semibold">{reasoning.strategy.label}</Badge>
              <span className="text-xs text-muted-foreground">{reasoning.strategy.description}</span>
            </div>
            {reasoning.details.length > 0 && (
              <>
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors w-full text-left mt-2"
                >
                  <Lightbulb className="h-4 w-4" />
                  <span>Why?</span>
                  {showReasoning ? (
                    <ChevronUp className="h-3 w-3 ml-auto" />
                  ) : (
                    <ChevronDown className="h-3 w-3 ml-auto" />
                  )}
                </button>
                {showReasoning && (
                  <ul className="mt-2 space-y-1.5 pl-6 animate-fade-in">
                    {reasoning.details.map((detail, di) => (
                      <li key={di} className="text-xs text-muted-foreground leading-relaxed list-disc">
                        {detail}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {/* Numbers */}
        {quickRef ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <div><span className="text-xs text-muted-foreground">Start Fuel</span> <span className="font-bold">{formatWeight(leg.startFuel)}</span></div>
              <div className="text-xs text-muted-foreground">~{Math.round(Math.abs(leg.fuelUpliftGals))} gal uplift · {formatCurrency(Math.abs(leg.totalCost))}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="block">TO Weight</span>
                <span className="font-medium text-foreground">{formatWeight(leg.takeoffWeight)}</span>
              </div>
              <div>
                <span className="block">Fuel Burn</span>
                <span className="font-medium text-foreground">{formatWeight(leg.fuelBurn)}</span>
              </div>
              <div>
                <span className="block">Landing Fuel</span>
                <span className={`font-medium ${leg.landingFuel < 0 ? "text-destructive" : "text-foreground"}`}>{formatWeight(leg.landingFuel)}</span>
              </div>
              <div>
                <span className="block">Ldg Weight</span>
                <span className={`font-medium ${leg.landingWeight < 0 ? "text-destructive" : "text-foreground"}`}>{formatWeight(leg.landingWeight)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <div>
              <span className="text-muted-foreground">Start Fuel</span>
              <p className="text-lg font-bold">{formatWeight(leg.startFuel)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Estimated Fuel to Uplift</span>
              <p className="font-medium">{Math.round(Math.abs(leg.fuelUpliftGals))} gal. / {formatWeight(Math.abs(leg.fuelUpliftLbs))}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Fuel Cost</span>
              <p className="font-medium">{formatCurrency(Math.abs(leg.fuelCost))}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Fuel Burn</span>
              <p>{formatWeight(leg.fuelBurn)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Landing Fuel</span>
              <p className={leg.landingFuel < 0 ? "text-destructive font-bold" : ""}>
                {formatWeight(leg.landingFuel)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Total Cost</span>
              <p className="font-bold">{formatCurrency(Math.abs(leg.totalCost))}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Takeoff Weight</span>
              <p>{formatWeight(leg.takeoffWeight)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Landing Weight</span>
              <p className={leg.landingWeight < 0 ? "text-destructive font-bold" : ""}>
                {formatWeight(leg.landingWeight)}
              </p>
            </div>
          </div>
        )}
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

      // If maxFuelLbs isn't stored, fetch from the aircraft profile
      if (!details.maxFuelLbs && details.aircraftNumber) {
        const { data: aircraft } = await supabase
          .from("aircrafts")
          .select("max_fuel_capacity")
          .eq("tail_number", details.aircraftNumber)
          .single();
        if (aircraft?.max_fuel_capacity) {
          details.maxFuelLbs = aircraft.max_fuel_capacity;
        }
      }

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
  const legReasonings = generateLegReasoning(summary.legs, summary.savings, summary.maxFuelLbs ?? 0);
  const overallReasoning = generateOverallReasoning(summary.legs, summary.savings, summary.maxFuelLbs ?? 0);

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 px-3 sm:p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Trip Summary</h1>
          <p className="text-sm text-muted-foreground truncate">
            {summary.aircraftNumber}
            {summary.itineraryNum ? ` — Trip #${summary.itineraryNum}` : ""}
          </p>
        </div>
        <ItineraryViewer tripId={tripId!} />
      </div>

      {/* Savings */}
      {summary.savings > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">Estimated Savings</span>
          <span className="text-lg font-semibold text-primary">{formatCurrency(summary.savings)}</span>
        </div>
      )}

      {/* Overall Reasoning */}
      <Card data-demo="optimizer-strategy" className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex gap-3 items-start">
            <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Optimizer Strategy</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{overallReasoning}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <Button
          data-demo="full-summary-btn"
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
          <LegDetail
            key={i}
            leg={leg}
            index={i}
            quickRef={quickRef}
            reasoning={legReasonings[i]}
          />
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
          data-demo="send-email-btn"
          className="flex-1 bg-primary hover:bg-primary/90"
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
