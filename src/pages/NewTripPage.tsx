import { pendingParseFile } from "@/lib/pending-parse-file";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { useDemo, DEMO_PDF_PATH } from "@/contexts/DemoContext";
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
import { ArrowLeft, FileUp, Loader2, Plane, ArrowRight, Plus, FileText, Check } from "lucide-react";

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
  const { active: demoActive, currentStep } = useDemo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);
  const [selectedTail, setSelectedTail] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showDemoFilePicker, setShowDemoFilePicker] = useState(false);
  const [demoFileSelected, setDemoFileSelected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (creating) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Invalid file", description: "Please drop a PDF file", variant: "destructive" });
      return;
    }
    handlePdfUpload(file);
  };

  // Auto-upload demo PDF when demo is active on the upload step
  const demoTriggered = useRef(false);
  useEffect(() => {
    if (!demoActive || !user) return;
    if (currentStep?.id !== 'upload-pdf') return;
    if (demoTriggered.current) return;
    if (creating) return;
    demoTriggered.current = true;
  }, [demoActive, currentStep, user, creating]);

  // Reset demo file picker when leaving relevant steps
  useEffect(() => {
    if (!demoActive || (currentStep?.id !== 'upload-pdf' && currentStep?.id !== 'select-sample-file')) {
      setShowDemoFilePicker(false);
      setDemoFileSelected(false);
    }
  }, [demoActive, currentStep]);

  // Auto-show file picker when arriving at select-sample-file step
  useEffect(() => {
    if (demoActive && currentStep?.id === 'select-sample-file') {
      setShowDemoFilePicker(true);
    }
  }, [demoActive, currentStep]);

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

  const handleDemoFileSelect = async () => {
    setDemoFileSelected(true);
    // Brief delay to show the check mark, then upload
    setTimeout(async () => {
      const res = await fetch(DEMO_PDF_PATH);
      const blob = await res.blob();
      const file = new File([blob], 'sample-itinerary.pdf', { type: 'application/pdf' });
      setShowDemoFilePicker(false);
      handlePdfUpload(file);
    }, 600);
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
        </div>
      </div>

      {/* Primary: Upload PDF */}
      <Card className="border-2 border-primary bg-primary/5 shadow-md">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
              <FileUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold">Upload trip itinerary</p>
              <p className="text-xs text-muted-foreground">Recommended — fastest way to get started</p>
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

          <Button data-demo="upload-pdf-area" size="lg" className="w-full text-base" onClick={() => {
            if (demoActive && currentStep?.id === 'upload-pdf') {
              setShowDemoFilePicker(true);
              return;
            }
            fileInputRef.current?.click();
          }} disabled={creating}>
            {creating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <FileUp className="h-5 w-5 mr-2" />}
            Upload PDF
          </Button>

          {/* Demo fake file picker */}
          {showDemoFilePicker && (
            <div className="border rounded-lg bg-background shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-3 py-2 border-b bg-muted/50 flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Select a file</p>
                <button
                  onClick={() => setShowDemoFilePicker(false)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>
              <button
                data-demo="demo-sample-file"
                onClick={handleDemoFileSelect}
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-accent/50 transition-colors text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 shrink-0">
                  <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">sample-itinerary.pdf</p>
                  <p className="text-xs text-muted-foreground">Trip sheet · 42 KB</p>
                </div>
                {demoFileSelected ? (
                  <Check className="h-5 w-5 text-primary shrink-0 animate-in zoom-in duration-200" />
                ) : (
                  <div className="h-5 w-5 rounded border-2 border-muted-foreground/30 shrink-0" />
                )}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secondary: Start blank */}
      {aircraftList.length === 0 ? (
        <div className="border border-dashed rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plane className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Or start blank —</p>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/fleet/add")}>
              <Plus className="h-4 w-4 mr-1" />
              Add aircraft first
            </Button>
          </div>
        </div>
      ) : (
        <div className="border border-dashed rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Or start blank</p>
          </div>

          {aircraftList.length === 1 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm">
                {aircraftList[0].tail_number} <span className="text-muted-foreground">— {aircraftList[0].manufacturer} {aircraftList[0].type}</span>
              </p>
              <Button variant="outline" size="sm" onClick={handleManualStart} disabled={!selectedTail || creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Select value={selectedTail} onValueChange={setSelectedTail}>
                <SelectTrigger className="flex-1 h-9 text-sm">
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
              <Button variant="outline" size="sm" onClick={handleManualStart} disabled={!selectedTail || creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
