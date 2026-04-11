// DashboardPage — Main authenticated landing page.
// Route: /dashboard
// Shows action cards (Plan Trip, Manage Fleet, Savings) and recent trips list.

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import type { TripSummary } from "@/types/trip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plane, Settings, TrendingUp, ChevronRight } from "lucide-react";

interface RecentTrip {
  id: number;
  itinerary_num: string;
  created_on: string;
  savings: number;
  details: TripSummary | null;
}

export default function DashboardPage() {
  const { user, profile } = useAuthContext();
  const navigate = useNavigate();
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrips() {
      if (!user) return;
      const { data } = await supabase
        .from("trips")
        .select("id, itinerary_num, created_on, savings, details")
        .eq("user_company", user.id)
        .order("created_on", { ascending: false })
        .limit(10);

      setRecentTrips(
        (data ?? []).map((t) => ({
          id: t.id,
          itinerary_num: t.itinerary_num || `Trip #${t.id}`,
          created_on: t.created_on,
          savings: t.savings ?? 0,
          details: t.details as unknown as TripSummary | null,
        })),
      );
      setLoading(false);
    }
    loadTrips();
  }, [user]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome{profile?.first_name ? `, ${profile.first_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">What would you like to do?</p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
          onClick={() => navigate("/trips/new")}
        >
          <CardContent className="pt-6 text-center">
            <Plane className="h-10 w-10 mx-auto mb-3 text-[#1a3a5c]" />
            <p className="font-semibold">Plan a Trip</p>
            <p className="text-xs text-muted-foreground mt-1">Fool-proof fuel planning</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
          onClick={() => navigate("/fleet")}
        >
          <CardContent className="pt-6 text-center">
            <Settings className="h-10 w-10 mx-auto mb-3 text-[#1a3a5c]" />
            <p className="font-semibold">Manage Fleet</p>
            <p className="text-xs text-muted-foreground mt-1">View & edit aircraft</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
          onClick={() => navigate("/savings")}
        >
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-10 w-10 mx-auto mb-3 text-green-600" />
            <p className="font-semibold">Savings</p>
            <p className="text-xs text-muted-foreground mt-1">Track your fuel savings</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trips */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Trips</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : recentTrips.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p>No trips yet. Plan your first trip to get started!</p>
              <Button asChild className="mt-3 bg-[#1a3a5c]">
                <Link to="/trips/new">Plan a Trip</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentTrips.map((trip) => (
              <Card
                key={trip.id}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => navigate(`/trips/${trip.id}/summary`)}
              >
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{trip.itinerary_num}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(trip.created_on)}</p>
                    {trip.details?.aircraftNumber && (
                      <p className="text-xs text-muted-foreground">{trip.details.aircraftNumber}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {trip.savings > 0 && (
                      <span className="text-sm font-semibold text-green-600">
                        +${trip.savings.toFixed(0)}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
