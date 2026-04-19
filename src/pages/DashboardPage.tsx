import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { useDemo } from "@/contexts/DemoContext";
import type { TripSummary } from "@/types/trip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plane, Settings, TrendingUp, ChevronRight, FileUp, Play } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface RecentTrip {
  id: number;
  itinerary_num: string;
  created_on: string | null;
  savings: number;
  details: TripSummary | null;
}

export default function DashboardPage() {
  const { user, profile } = useAuthContext();
  const { startDemo } = useDemo();
  const navigate = useNavigate();
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);
  const [aircraftCount, setAircraftCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: tripsData }, { count }] = await Promise.all([
        supabase
          .from("trips")
          .select("id, itinerary_num, created_on, savings, details")
          .eq("user_company", user.id)
          .order("created_on", { ascending: false })
          .limit(10),
        supabase
          .from("aircrafts")
          .select("id", { count: "exact", head: true })
          .eq("user_company", user.id)
          .eq("is_enabled", true),
      ]);

      setRecentTrips(
        (tripsData ?? []).map((trip) => ({
          id: trip.id,
          itinerary_num: trip.itinerary_num || `Trip #${trip.id}`,
          created_on: trip.created_on ?? null,
          savings: trip.savings ?? 0,
          details: trip.details as unknown as TripSummary | null,
        })),
      );
      setAircraftCount(count ?? 0);
      setLoading(false);
    }

    loadDashboard();
  }, [user]);

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const name = profile?.first_name?.trim();
  const isFirstRun = aircraftCount === 0 && recentTrips.length === 0;
  const hasNoTrips = recentTrips.length === 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          {isFirstRun
            ? "Start here"
            : hasNoTrips
              ? `Ready${name ? `, ${name}` : ""}?`
              : `Welcome${name ? `, ${name}` : ""}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isFirstRun ? "Add aircraft. Then plan." : hasNoTrips ? "Pick one." : "Jump back in."}
        </p>
      </div>

      {isFirstRun ? (
        <div className="grid gap-4">
          <Card
            className="cursor-pointer border-primary/20 bg-primary/5 transition-all hover:border-primary/40 hover:bg-primary/10"
            onClick={() => navigate("/fleet/add")}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Plane className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Add aircraft</p>
                  <p className="text-sm text-muted-foreground">First step</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:border-primary/30 hover:bg-secondary/40"
            onClick={() => navigate("/trips/new")}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-foreground">
                  <FileUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Upload trip sheet</p>
                  <p className="text-sm text-muted-foreground">Have a PDF?</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      ) : hasNoTrips ? (
        <div className="space-y-4">
          <Card
            className="cursor-pointer border-primary/20 bg-primary/5 transition-all hover:border-primary/40 hover:bg-primary/10"
            onClick={() => navigate("/trips/new")}
          >
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Start first trip</p>
                  <p className="text-sm text-muted-foreground">Upload PDF or go blank</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-muted-foreground">Fleet ready</p>
                <p className="text-lg font-semibold">
                  {aircraftCount} aircraft{aircraftCount === 1 ? "" : "s"}
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate("/fleet")}>
                View Fleet
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card
              className="cursor-pointer transition-all hover:border-primary/30 hover:bg-secondary/40"
              onClick={() => navigate("/trips/new")}
            >
              <CardContent className="pt-6 text-center">
                <Plane className="mx-auto mb-3 h-10 w-10 text-primary" />
                <p className="font-semibold">Plan a trip</p>
                <p className="mt-1 text-xs text-muted-foreground">Upload or blank</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-all hover:border-primary/30 hover:bg-secondary/40"
              onClick={() => navigate("/fleet")}
            >
              <CardContent className="pt-6 text-center">
                <Settings className="mx-auto mb-3 h-10 w-10 text-primary" />
                <p className="font-semibold">Manage fleet</p>
                <p className="mt-1 text-xs text-muted-foreground">{aircraftCount} ready</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-all hover:border-primary/30 hover:bg-secondary/40"
              onClick={() => navigate("/savings")}
            >
              <CardContent className="pt-6 text-center">
                <TrendingUp className="mx-auto mb-3 h-10 w-10 text-primary" />
                <p className="font-semibold">Savings</p>
                <p className="mt-1 text-xs text-muted-foreground">See results</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Trips</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/trips/new")}>
                New Trip
              </Button>
            </div>

            <div className="space-y-2">
              {recentTrips.map((trip) => (
                <Card
                  key={trip.id}
                  className="cursor-pointer transition-colors hover:bg-secondary/40"
                  onClick={() => navigate(`/trips/${trip.id}/summary`)}
                >
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{trip.itinerary_num}</p>
                      <p className="text-xs text-muted-foreground">
                        {trip.created_on ? formatDate(trip.created_on) : "Draft"}
                      </p>
                      {trip.details?.aircraftNumber ? (
                        <p className="text-xs text-muted-foreground">{trip.details.aircraftNumber}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      {trip.savings > 0 ? (
                        <span className="text-sm font-semibold text-primary">
                          +{formatCurrency(trip.savings)}
                        </span>
                      ) : null}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
