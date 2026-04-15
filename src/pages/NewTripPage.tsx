// NewTripPage — Start a new trip with two clear paths:
// 1. Upload an itinerary PDF (AI parses it, auto-matches aircraft)
// 2. Manual entry (pick aircraft, enter legs yourself)

import { pendingParseFile } from "@/lib/pending-parse-file";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileUp, Loader2, Plane, ArrowRight } from "lucide-react";

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
  const [selectedTail, setSelectedTail] = useState("");
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

  // Path 1: Upload PDF → create trip → navigate to legs with pending file
  const handlePdfUpload = async (file: File) => {
    if (!user) return;
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
    pendingParseFile.current = file;
    navigate(`/trips/${data.id}/legs`);
  };

  // Path 2: Manual → create trip with selected aircraft → navigate to legs
  const handleManualStart = async () => {
    if (!user || !selectedTail) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_company: user.id,
        itinerary_num: "",
        details: {},
        itinerary_details: {
          itineraryNum: "",
          startingFuel: 0,
          aircraftId: selectedTail,
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
    <div className="max-w-lg mx-auto space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">New Trip</h1>
      </div>

      {/* Option 1: Upload Itinerary */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Upload Itinerary</p>
              <p className="text-xs text-muted-foreground">
                Upload a PDF trip sheet — we'll auto-fill everything
              </p>
            </div>
          </div>
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
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4 mr-2" />
            )}
            Choose PDF
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Option 2: Manual Entry */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Plane className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Enter Manually</p>
              <p className="text-xs text-muted-foreground">
                Pick your aircraft and enter leg details yourself
              </p>
            </div>
          </div>

          {aircraftList.length === 0 ? (
            <div className="text-center py-3">
              <p className="text-sm text-muted-foreground mb-2">No aircraft in your fleet yet.</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/fleet/add")}>
                Add Aircraft
              </Button>
            </div>
          ) : (
            <>
              <Select value={selectedTail} onValueChange={setSelectedTail}>
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
              <Button
                className="w-full"
                onClick={handleManualStart}
                disabled={!selectedTail || creating}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                Start Trip
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
