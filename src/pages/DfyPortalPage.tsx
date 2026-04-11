// DfyPortalPage — Client-facing portal for DFY fuel planning service.
// Route: /dfy
// DFY clients log in and upload trip sheet PDFs for fuel optimization.

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Loader2, Plane, Clock, CheckCircle, Send, XCircle } from "lucide-react";

interface DfyClient {
  id: string;
  company_name: string;
  pricing_tier: string;
  status: string;
}

interface DfyRequest {
  id: string;
  status: string;
  created_at: string;
  admin_notes: string;
  pdf_storage_path: string | null;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending Review", icon: <Clock className="h-3 w-3" />, variant: "secondary" },
  processing: { label: "Processing", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "outline" },
  approved: { label: "Approved", icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
  sent: { label: "Sent", icon: <Send className="h-3 w-3" />, variant: "default" },
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

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    const { data: clients } = await supabase
      .from("dfy_clients" as any)
      .select("id, company_name, pricing_tier, status")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .limit(1);

    if (clients && clients.length > 0) {
      const c = clients[0] as any;
      setClient(c as DfyClient);

      const { data: reqs } = await supabase
        .from("dfy_requests" as any)
        .select("id, status, created_at, admin_notes, pdf_storage_path")
        .eq("client_id", c.id)
        .order("created_at", { ascending: false });

      setRequests((reqs ?? []) as DfyRequest[]);
    }
    setLoading(false);
  }

  const handleUpload = async (file: File) => {
    if (!user || !client) return;
    setUploading(true);

    try {
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("dfy-uploads")
        .upload(fileName, file, { contentType: "application/pdf" });

      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase
        .from("dfy_requests" as any)
        .insert({
          client_id: client.id,
          pdf_storage_path: fileName,
          status: "pending",
        } as any);

      if (insertErr) throw insertErr;

      toast({ title: "Trip sheet uploaded", description: "Your fuel plan request has been submitted." });
      await loadData();
    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
          {client.company_name} · {client.pricing_tier === "per_trip" ? "$200/trip" : "$10,000/month"}
        </p>
      </div>

      {/* Upload Card */}
      <Card className="border-dashed border-2">
        <CardContent className="pt-6 text-center">
          <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Upload Trip Sheet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your itinerary PDF and we'll optimize your fuel plan
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4 mr-2" />
            )}
            {uploading ? "Uploading..." : "Choose PDF"}
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
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(req.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      {req.admin_notes && (
                        <p className="text-xs text-muted-foreground mt-1">{req.admin_notes}</p>
                      )}
                    </div>
                    <Badge variant={sc.variant} className="flex items-center gap-1">
                      {sc.icon}
                      {sc.label}
                    </Badge>
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
