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
import { ArrowLeft, FileUp, Loader2, Plane, ArrowRight, Plus } from "lucide-react";

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
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("aircrafts")
        .select("id, tail_number, manufacturer, type")
        .eq("user_company", user.id)
        .eq("is_enabled", true)
        .order("tail_number");

      const nextAircraft = data ?? [];
      setAircraftList(nextAircraft);
      if (nextAircraft.length === 1) {
        setSelectedTail(nextAircraft[0].tail_number);
      }
      setLoading(false);
    }

    loadAircraft();
  }, [user]);

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
        <div>
          <h1 className="text-2xl font-bold">Start a Trip</h1>
          <p className="text-sm text-muted-foreground">Upload PDF or go blank.</p>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Upload PDF</p>
              <p className="text-xs text-muted-foreground">Fastest path</p>
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

          <Button className="w-full" onClick={() => fileInputRef.current?.click()} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
            Upload PDF
          </Button>
        </CardContent>
      </Card>

      {aircraftList.length === 0 ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground shrink-0">
                <Plane className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Add aircraft</p>
                <p className="text-xs text-muted-foreground">Needed for blank trips</p>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={() => navigate("/fleet/add")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Aircraft
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground shrink-0">
                <Plane className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Start blank</p>
                <p className="text-xs text-muted-foreground">
                  {aircraftList.length === 1 ? "Aircraft ready" : "Pick aircraft"}
                </p>
              </div>
            </div>

            {aircraftList.length === 1 ? (
              <div className="rounded-xl border bg-secondary/40 px-4 py-3">
                <p className="text-sm font-medium">{aircraftList[0].tail_number}</p>
                <p className="text-xs text-muted-foreground">
                  {aircraftList[0].manufacturer} {aircraftList[0].type}
                </p>
              </div>
            ) : (
              <Select value={selectedTail} onValueChange={setSelectedTail}>
                <SelectTrigger>
                  <SelectValue placeholder="Select aircraft" />
                </SelectTrigger>
                <SelectContent>
                  {aircraftList.map((aircraft) => (
                    <SelectItem key={aircraft.id} value={aircraft.tail_number}>
                      {aircraft.tail_number} — {aircraft.manufacturer} {aircraft.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button className="w-full" onClick={handleManualStart} disabled={!selectedTail || creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Start Blank
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
