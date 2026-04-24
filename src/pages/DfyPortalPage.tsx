// DfyPortalPage — Client-facing portal for DFY fuel planning service.
// Route: /dfy
// DFY clients upload trip sheet PDFs with fuel burns for fuel optimization.

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyCents } from "@/lib/format";
import {
  FileUp, Loader2, Plane, Clock, CheckCircle, Send, XCircle,
  Plus, Trash2, Fuel, FileDown,
} from "lucide-react";

interface DfyClient {
  id: string;
  company_name: string;
  pricing_tier: string;
  per_trip_rate_cents: number;
  status: string;
}

interface DfyRequest {
  id: string;
  status: string;
  created_at: string;
  admin_notes: string;
  pdf_storage_path: string | null;
  fuel_burns: FuelBurnEntry[];
  fuel_on_board_lbs: number | null;
  parsed_result: Record<string, unknown>;
}

interface FuelBurnEntry {
  leg: number;
  departure: string;
  destination: string;
  fuel_burn_lbs: number;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending Review", icon: <Clock className="h-3 w-3" />, variant: "secondary" },
  processing: { label: "Processing", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "outline" },
  approved: { label: "Approved", icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
  sent: { label: "Complete", icon: <Send className="h-3 w-3" />, variant: "default" },
  rejected: { label: "Rejected", icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
};

export default function DfyPortalPage() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [client, setClient] = useState<DfyClient | null>(null);
  const [requests, setRequests] = useState<DfyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Fuel burn entries for new request
  const [fuelBurns, setFuelBurns] = useState<FuelBurnEntry[]>([
    { leg: 1, departure: "", destination: "", fuel_burn_lbs: 0 },
  ]);
  const [fuelOnBoard, setFuelOnBoard] = useState<number | "">("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    // Any logged-in user can access the DFY portal. Auto-provision a
    // dfy_clients row on first visit so the portal is immediately usable.
    let { data: clients } = await supabase
      .from("dfy_clients" as any)
      .select("id, company_name, pricing_tier, per_trip_rate_cents, status")
      .eq("user_id", user!.id)
      .limit(1);

    if (!clients || clients.length === 0) {
      // Pull name/email from profile for a sensible default company name.
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, company")
        .eq("id", user!.id)
        .maybeSingle();

      const companyName =
        (profile?.company && profile.company.trim()) ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
        profile?.email ||
        "DFY Client";

      const { data: inserted, error: insertErr } = await supabase
        .from("dfy_clients" as any)
        .insert({
          user_id: user!.id,
          company_name: companyName,
          contact_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
          contact_email: profile?.email ?? "",
          pricing_tier: "per_trip",
        } as any)
        .select("id, company_name, pricing_tier, per_trip_rate_cents, status")
        .limit(1);

      if (!insertErr && inserted) {
        clients = inserted;
      }
    }

    if (clients && clients.length > 0) {
      const c = clients[0] as any;
      setClient(c as DfyClient);

      const { data: reqs } = await supabase
        .from("dfy_requests" as any)
        .select("id, status, created_at, admin_notes, pdf_storage_path, fuel_burns, fuel_on_board_lbs, parsed_result")
        .eq("client_id", c.id)
        .order("created_at", { ascending: false });

      setRequests((reqs ?? []) as unknown as DfyRequest[]);
    }
    setLoading(false);
  }

  function addLeg() {
    setFuelBurns([...fuelBurns, {
      leg: fuelBurns.length + 1,
      departure: "",
      destination: "",
      fuel_burn_lbs: 0,
    }]);
  }

  function removeLeg(index: number) {
    if (fuelBurns.length <= 1) return;
    const updated = fuelBurns.filter((_, i) => i !== index).map((fb, i) => ({ ...fb, leg: i + 1 }));
    setFuelBurns(updated);
  }

  function updateLeg(index: number, field: keyof FuelBurnEntry, value: string | number) {
    const updated = [...fuelBurns];
    updated[index] = { ...updated[index], [field]: value };
    setFuelBurns(updated);
  }

  const handleSubmit = async () => {
    if (!user || !client || !selectedFile) {
      toast({ title: "Please select a PDF file", variant: "destructive" });
      return;
    }

    // Validate fuel burns
    const hasEmptyLegs = fuelBurns.some(fb => !fb.departure.trim() || !fb.destination.trim() || fb.fuel_burn_lbs <= 0);
    if (hasEmptyLegs) {
      toast({ title: "Fill in all leg details", description: "Each leg needs departure, destination, and fuel burn.", variant: "destructive" });
      return;
    }

    setUploading(true);

    try {
      // Upload PDF
      const fileName = `${user.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("dfy-uploads")
        .upload(fileName, selectedFile, { contentType: "application/pdf" });

      if (uploadErr) throw uploadErr;

      // Auto-parse the PDF
      let parsedResult = {};
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const pdfBase64 = btoa(binary);

        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-itinerary`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ pdf_base64: pdfBase64 }),
          },
        );

        if (resp.ok) {
          parsedResult = await resp.json();
        }
      } catch (parseErr) {
        console.error("Auto-parse failed (non-blocking):", parseErr);
      }

      // Create request with fuel burns, fuel-on-board estimate, and parsed result
      const { error: insertErr } = await supabase
        .from("dfy_requests" as any)
        .insert({
          client_id: client.id,
          pdf_storage_path: fileName,
          status: "pending",
          fuel_burns: fuelBurns,
          fuel_on_board_lbs: typeof fuelOnBoard === "number" ? fuelOnBoard : null,
          parsed_result: parsedResult,
        } as any);

      if (insertErr) throw insertErr;

      toast({ title: "Request submitted", description: "Your trip sheet and fuel burns have been submitted for review." });
      setSelectedFile(null);
      setFuelBurns([{ leg: 1, departure: "", destination: "", fuel_burn_lbs: 0 }]);
      setFuelOnBoard("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadData();
    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  async function downloadResult(req: DfyRequest) {
    if (!req.pdf_storage_path) return;
    const { data: blob, error } = await supabase.storage
      .from("dfy-uploads")
      .download(req.pdf_storage_path);

    if (error || !blob) {
      toast({ title: "Download failed", variant: "destructive" });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = req.pdf_storage_path.split("/").pop() || "itinerary.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-md mx-auto text-center p-8">
        <Plane className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-xl font-bold mb-2">No Active DFY Service</h1>
        <p className="text-muted-foreground">
          You don't have an active Done-For-You fuel planning subscription.
          Contact us to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Fuel Planning Portal</h1>
        <p className="text-sm text-muted-foreground">
          {client.company_name} · {formatCurrencyCents(client.per_trip_rate_cents)}/trip
        </p>
      </div>

      {/* Upload Card with Fuel Burns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            New Fuel Plan Request
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* PDF Upload */}
          <div>
            <Label className="text-sm font-medium">Trip Sheet PDF</Label>
            <div className="mt-2 border-2 border-dashed rounded-lg p-4 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                }}
              />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{selectedFile.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="h-4 w-4 mr-2" /> Choose PDF
                </Button>
              )}
            </div>
          </div>

          {/* Fuel Burns per Leg */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Fuel className="h-4 w-4 text-primary" />
                Fuel Burns per Leg
              </Label>
              <Button variant="outline" size="sm" onClick={addLeg}>
                <Plus className="h-3 w-3 mr-1" /> Add Leg
              </Button>
            </div>

            <div className="space-y-3">
              {fuelBurns.map((fb, index) => (
                <div key={index} className="flex items-center gap-2 p-3 rounded-lg border bg-secondary/30">
                  <span className="text-xs font-semibold text-muted-foreground w-8">L{fb.leg}</span>
                  <Input
                    placeholder="ICAO"
                    value={fb.departure}
                    onChange={(e) => updateLeg(index, "departure", e.target.value.toUpperCase())}
                    className="h-8 text-xs w-20"
                    maxLength={4}
                  />
                  <span className="text-muted-foreground text-xs">→</span>
                  <Input
                    placeholder="ICAO"
                    value={fb.destination}
                    onChange={(e) => updateLeg(index, "destination", e.target.value.toUpperCase())}
                    className="h-8 text-xs w-20"
                    maxLength={4}
                  />
                  <Input
                    type="number"
                    placeholder="Fuel burn (lbs)"
                    value={fb.fuel_burn_lbs || ""}
                    onChange={(e) => updateLeg(index, "fuel_burn_lbs", Number(e.target.value))}
                    className="h-8 text-xs flex-1"
                    min={0}
                  />
                  {fuelBurns.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeLeg(index)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={uploading || !selectedFile} className="w-full">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Request · {formatCurrencyCents(client.per_trip_rate_cents)}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Request History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No requests yet. Upload a trip sheet to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const sc = statusConfig[req.status] || statusConfig.pending;
                const parsedTrip = req.parsed_result as any;
                const hasParsedResult = parsedTrip && parsedTrip.itinerary_num;
                const fuelBurnsList = (req.fuel_burns || []) as FuelBurnEntry[];

                return (
                  <div key={req.id} className="p-4 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {hasParsedResult ? `Itinerary: ${parsedTrip.itinerary_num}` : 
                            new Date(req.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                              hour: "numeric", minute: "2-digit",
                            })
                          }
                        </p>
                        {hasParsedResult && parsedTrip.aircraft && (
                          <p className="text-xs text-muted-foreground">Aircraft: {parsedTrip.aircraft}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {req.pdf_storage_path && (
                          <Button variant="ghost" size="sm" onClick={() => downloadResult(req)}>
                            <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                          </Button>
                        )}
                        <Badge variant={sc.variant} className="flex items-center gap-1">
                          {sc.icon}
                          {sc.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Show fuel burns */}
                    {fuelBurnsList.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {fuelBurnsList.map((fb, i) => (
                          <span key={i} className="text-xs bg-secondary px-2 py-1 rounded">
                            {fb.departure} → {fb.destination}: {fb.fuel_burn_lbs} lbs
                          </span>
                        ))}
                      </div>
                    )}

                    {req.admin_notes && (
                      <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                        Admin: {req.admin_notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
