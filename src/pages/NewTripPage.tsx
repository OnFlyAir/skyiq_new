// NewTripPage — Start a new trip: select aircraft, optionally upload itinerary.
// Route: /trips/new
// Creates a trip record in Supabase, then navigates to the legs editor.

import { pendingParseFile } from "@/lib/pending-parse-file";

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileUp, Loader2, Plane, Plus } from "lucide-react";

interface Aircraft {
  id: number;
  tail_number: string;
  manufacturer: string;
  type: string;
}

export default function NewTripPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuthContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function loadAircraft() {
      if (!user) return;
      const { data } = await supabase
        .from("aircrafts")
        .select("id, tail_number, manufacturer, type")
        .eq("user_company", user.id)
        .eq("is_enabled", true)
        .order("tail_number");

      setAircraftList(data ?? []);
      setLoading(false);
    }
    loadAircraft();
  }, [user]);

  const createTrip = async (aircraftTail: string) => {
    if (!user) return;
    setCreating(true);

    // Create trip record
    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_company: user.id,
        itinerary_num: "",
        details: {},
        itinerary_details: {
          itineraryNum: "",
          startingFuel: 0,
          aircraftId: aircraftTail,
          basicEmptyWeight: 0,
          maxFuelReserve: 0,
          penalty: 0,
          lbsPerHour: 0,
          legs: [],
        },
        savings: 0,
      })
      .select("id")
      .single();

    setCreating(false);

    if (error || !data) {
      toast({ title: "Error", description: "Failed to create trip", variant: "destructive" });
      return;
    }

    navigate(`/trips/${data.id}/legs`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Plan a Trip</h1>
      </div>

      {/* Upload Itinerary Option */}
      <Card className="border-dashed border-2">
        <CardContent className="pt-6 text-center">
          <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Start with an Itinerary</p>
          <p className="text-sm text-muted-foreground mb-4">
            Create a trip and upload your PDF on the next page
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !user) return;
              setCreating(true);
              const { data, error } = await supabase
                .from("trips")
                .insert({
                  user_company: user.id,
                  itinerary_num: "",
                  details: {},
                  itinerary_details: { legs: [] },
                  savings: 0,
                })
                .select("id")
                .single();
              setCreating(false);
              if (error || !data) {
                toast({ title: "Error", description: "Failed to create trip", variant: "destructive" });
                return;
              }
              // Store file reference for the legs page to pick up
              pendingParseFile.current = file;
              navigate(`/trips/${data.id}/legs`);
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={creating}
          >
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
            Choose PDF
          </Button>
        </CardContent>
      </Card>

      {/* Or select aircraft for manual trip */}
      <div className="text-center text-sm text-muted-foreground">— or select an aircraft —</div>

      {/* Aircraft Grid */}
      {aircraftList.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-3">No aircraft in your fleet yet.</p>
            <Button onClick={() => navigate("/fleet/add")}>
              <Plus className="h-4 w-4 mr-2" /> Add Aircraft
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {aircraftList.map((ac) => (
            <Card
              key={ac.id}
              className="cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
              onClick={() => createTrip(ac.tail_number)}
            >
              <CardContent className="pt-4 text-center">
                <Plane className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="font-bold text-lg">{ac.tail_number}</p>
                <p className="text-xs text-muted-foreground">
                  {ac.manufacturer} {ac.type}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Creating trip...</span>
        </div>
      )}
    </div>
  );
}
