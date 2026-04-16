// SavingsPage — Savings dashboard showing per-aircraft fuel savings.
// Route: /savings
// Mirrors the original SavingsAccrued view.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Plane, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface AircraftSavings {
  tailNumber: string;
  tripsRun: number;
  savings: number;
}

export default function SavingsPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [data, setData] = useState<AircraftSavings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;

      // Fetch aircraft
      const { data: aircraft } = await supabase
        .from("aircrafts")
        .select("tail_number")
        .eq("user_company", user.id)
        .eq("is_enabled", true);

      // Fetch trips
      const { data: trips } = await supabase
        .from("trips")
        .select("itinerary_details, savings")
        .eq("user_company", user.id);

      const result: AircraftSavings[] = (aircraft ?? []).map((ac) => {
        const acTrips = (trips ?? []).filter((t) => {
          const itinerary = t.itinerary_details as Record<string, unknown> | null;
          return itinerary && (itinerary as { aircraftId?: string }).aircraftId === ac.tail_number;
        });

        return {
          tailNumber: ac.tail_number,
          tripsRun: acTrips.length,
          savings: acTrips.reduce((sum, t) => sum + (t.savings ?? 0), 0),
        };
      });

      setData(result);
      setLoading(false);
    }
    load();
  }, [user]);

  const totalSavings = data.reduce((sum, d) => sum + d.savings, 0);
  const totalTrips = data.reduce((sum, d) => sum + d.tripsRun, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Potential Savings Earned</h1>
          <p className="text-xs text-muted-foreground">
            Savings represent 50% of the difference between worst-case and optimized fuel costs.
          </p>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-1 text-green-600" />
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalSavings)}
            </p>
            <p className="text-xs text-muted-foreground">Total Savings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Plane className="h-6 w-6 mx-auto mb-1 text-[#1a3a5c]" />
            <p className="text-2xl font-bold">{totalTrips}</p>
            <p className="text-xs text-muted-foreground">Fuel Plans Calculated</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Aircraft Grid */}
      {data.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>No aircraft with trip data yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {data.map((ac) => (
            <Card key={ac.tailNumber}>
              <CardContent className="pt-4 text-center">
                <Plane className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                <p className="font-bold text-lg">{ac.tailNumber}</p>
                <p className="text-xl font-bold text-green-600 mt-1">
                  {formatCurrency(ac.savings)}
                </p>
                <p className="text-xs text-muted-foreground">{ac.tripsRun} trip{ac.tripsRun !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
