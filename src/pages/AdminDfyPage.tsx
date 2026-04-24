// AdminDfyPage — Admin management for Done-For-You fuel planning service.
// Route: /admin/dfy
// Manage DFY clients, view/process requests, run optimizer, send results.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatCurrencyCents } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Building2, Clock, CheckCircle, FileText, Loader2,
  Plus, Send, Users, XCircle, DollarSign,
} from "lucide-react";

interface DfyClient {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  pricing_tier: string;
  per_trip_rate_cents: number;
  monthly_rate_cents: number;
  status: string;
  created_at: string;
}

interface FuelBurnEntry {
  leg: number;
  departure: string;
  destination: string;
  fuel_burn_lbs: number;
}

interface ParsedLeg {
  departure?: string;
  destination?: string;
}

interface ParsedResult {
  itinerary_num?: string;
  aircraft?: string;
  legs?: ParsedLeg[];
}

interface DfyRequest {
  id: string;
  client_id: string;
  status: string;
  pdf_storage_path: string | null;
  admin_notes: string;
  created_at: string;
  reviewed_at: string | null;
  sent_at: string | null;
  fuel_burns: FuelBurnEntry[] | null;
  fuel_on_board_lbs: number | null;
  parsed_result: ParsedResult | null;
  client?: DfyClient;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  processing: "outline",
  approved: "default",
  sent: "default",
  rejected: "destructive",
};

export default function AdminDfyPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isAdmin = profile?.role_name === "Admin";

  const [clients, setClients] = useState<DfyClient[]>([]);
  const [requests, setRequests] = useState<DfyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    company_name: "",
    contact_name: "",
    contact_email: "",
    pricing_tier: "per_trip" as string,
    user_id: "",
  });
  const [profiles, setProfiles] = useState<{ id: string; email: string; company: string }[]>([]);
  const [savingClient, setSavingClient] = useState(false);
  const [usageCharges, setUsageCharges] = useState<Array<{
    id: string; user_id: string; amount_cents: number; status: string;
    invoice_period_end: string | null; created_at: string; description: string;
  }>>([]);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  async function loadData() {
    const [clientsRes, requestsRes, profilesRes, chargesRes] = await Promise.all([
      supabase.from("dfy_clients" as any).select("*").order("created_at", { ascending: false }),
      supabase
        .from("dfy_requests" as any)
        .select("id, client_id, status, pdf_storage_path, admin_notes, created_at, reviewed_at, sent_at, fuel_burns, fuel_on_board_lbs, parsed_result")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, company"),
      (supabase.from("dfy_usage_charges" as any) as any)
        .select("id, user_id, amount_cents, status, invoice_period_end, created_at, description")
        .order("created_at", { ascending: false }),
    ]);

    const clientsList = (clientsRes.data ?? []) as unknown as DfyClient[];
    const requestsList = (requestsRes.data ?? []) as unknown as DfyRequest[];

    // Attach client to each request
    const enriched = requestsList.map((r) => ({
      ...r,
      client: clientsList.find((c) => c.id === r.client_id),
    }));

    setClients(clientsList);
    setRequests(enriched);
    setProfiles((profilesRes.data ?? []) as { id: string; email: string; company: string }[]);
    setUsageCharges((chargesRes.data ?? []) as any);
    setLoading(false);
  }

  const addClient = async () => {
    if (!newClient.company_name || !newClient.contact_email || !newClient.user_id) {
      toast({ title: "Missing fields", description: "Fill in all required fields.", variant: "destructive" });
      return;
    }
    setSavingClient(true);

    const { error } = await supabase.from("dfy_clients" as any).insert({
      company_name: newClient.company_name,
      contact_name: newClient.contact_name,
      contact_email: newClient.contact_email,
      pricing_tier: newClient.pricing_tier,
      user_id: newClient.user_id,
    } as any);

    setSavingClient(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Client added" });
    setAddClientOpen(false);
    setNewClient({ company_name: "", contact_name: "", contact_email: "", pricing_tier: "per_trip", user_id: "" });
    loadData();
  };

  const updateRequestStatus = async (requestId: string, status: string) => {
    const updates: Record<string, unknown> = { status };
    if (status === "processing" || status === "approved") {
      updates.reviewed_by = profile?.id;
      updates.reviewed_at = new Date().toISOString();
    }
    if (status === "sent") {
      updates.sent_at = new Date().toISOString();
    }

    const { error } = await supabase.from("dfy_requests" as any).update(updates as any).eq("id", requestId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Billing side-effects: when sent → create a $25 metered charge that
    // attaches to the user's next subscription invoice. When rejected →
    // void the pending charge (or flag refund if already invoiced).
    const reqRow = requests.find((r) => r.id === requestId);
    const userId = reqRow?.client?.user_id;

    if (status === "sent" && userId && reqRow) {
      // Look up current subscription period end so the charge knows which invoice to attach to.
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("current_period_end")
        .eq("user_id", userId)
        .maybeSingle();

      const { error: chargeErr } = await (supabase.from("dfy_usage_charges" as any) as any).upsert(
        {
          user_id: userId,
          request_id: requestId,
          client_id: reqRow.client_id,
          amount_cents: reqRow.client?.per_trip_rate_cents ?? 2500,
          description: "Fuel Planning (DFY)",
          status: "pending_invoice",
          invoice_period_end: sub?.current_period_end ?? null,
        },
        { onConflict: "request_id" },
      );
      if (chargeErr) console.error("usage charge insert failed", chargeErr);

      try {
        await supabase.functions.invoke("notify-dfy", {
          body: { kind: "client_completed", request_id: requestId },
        });
        toast({ title: "Sent & billed", description: "$25 added to client's next invoice." });
      } catch (e) {
        console.error("client email failed", e);
        toast({ title: "Email failed", description: "Status & charge saved, but email did not send.", variant: "destructive" });
      }
    } else if (status === "rejected") {
      // Void any pending charge; flag for refund if it was already invoiced.
      const { data: existing } = await (supabase
        .from("dfy_usage_charges" as any) as any)
        .select("id, status")
        .eq("request_id", requestId)
        .maybeSingle();
      if (existing) {
        if (existing.status === "pending_invoice") {
          await (supabase.from("dfy_usage_charges" as any) as any)
            .update({ status: "voided", voided_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else if (existing.status === "invoiced") {
          await (supabase.from("dfy_usage_charges" as any) as any)
            .update({ status: "refunded", refunded_at: new Date().toISOString(), notes: "Auto-refund on reject" })
            .eq("id", existing.id);
        }
      }
      toast({ title: "Request rejected", description: "Any pending charge was voided / flagged for refund." });
    } else {
      toast({ title: `Request marked as ${status}` });
    }
    loadData();
  };

  const runStandardFlow = async (req: DfyRequest) => {
    if (!req.client) {
      toast({ title: "Missing client", variant: "destructive" });
      return;
    }
    const parsed = req.parsed_result || {};
    const fuelBurns = req.fuel_burns || [];

    // Build legs prefilled from parsed itinerary + fuel burns. We merge by leg
    // index so admin sees airports + burns already populated in /trips/.../legs.
    const parsedLegs = parsed.legs || [];
    const legs = (parsedLegs.length ? parsedLegs : fuelBurns).map((src, i) => {
      const burn = fuelBurns[i];
      const departure = (parsedLegs[i]?.departure || burn?.departure || "").toUpperCase();
      const destination = (parsedLegs[i]?.destination || burn?.destination || "").toUpperCase();
      return {
        departure,
        destination,
        fuelBurn: burn?.fuel_burn_lbs ?? 0,
      };
    });

    // Find an aircraft owned by the client matching the parsed tail number, if any.
    let aircraftTail = parsed.aircraft || "";
    if (aircraftTail) {
      const { data: ac } = await supabase
        .from("aircrafts")
        .select("tail_number")
        .eq("user_company", req.client.user_id)
        .eq("tail_number", aircraftTail)
        .limit(1);
      if (!ac || ac.length === 0) aircraftTail = "";
    }

    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        user_company: req.client.user_id,
        itinerary_num: parsed.itinerary_num || "",
        details: { source: "dfy", dfy_request_id: req.id },
        itinerary_details: {
          itineraryNum: parsed.itinerary_num || "",
          startingFuel: req.fuel_on_board_lbs ?? 0,
          aircraftId: aircraftTail,
          basicEmptyWeight: 0,
          maxFuelReserve: 0,
          penalty: 0,
          lbsPerHour: 0,
          legs,
        },
        savings: 0,
      })
      .select("id")
      .single();

    if (error || !trip) {
      toast({ title: "Failed to create trip", description: error?.message ?? "", variant: "destructive" });
      return;
    }

    // Move the request to processing if it's still pending so the dashboard reflects work-in-progress.
    if (req.status === "pending") {
      await supabase
        .from("dfy_requests" as any)
        .update({ status: "processing", reviewed_by: profile?.id, reviewed_at: new Date().toISOString() } as any)
        .eq("id", req.id);
    }

    toast({ title: "Trip prefilled", description: "Opening standard fuel-planning flow…" });
    navigate(`/trips/${trip.id}/legs`);
  };

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center p-8">
        <h1 className="text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Admin access required.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">Back to Dashboard</Button>
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const thisMonthRequests = requests.filter((r) => {
    const d = new Date(r.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // Real billing rollup driven by dfy_usage_charges (the source of truth
  // that flows onto the user's next subscription invoice).
  const billingByClient = clients.map((c) => {
    const userCharges = usageCharges.filter((ch) => ch.user_id === c.user_id);
    const pendingCents = userCharges.filter((ch) => ch.status === "pending_invoice").reduce((s, ch) => s + ch.amount_cents, 0);
    const invoicedCents = userCharges.filter((ch) => ch.status === "invoiced").reduce((s, ch) => s + ch.amount_cents, 0);
    const refundedCents = userCharges.filter((ch) => ch.status === "refunded").reduce((s, ch) => s + ch.amount_cents, 0);
    return {
      client: c,
      pendingCount: userCharges.filter((ch) => ch.status === "pending_invoice").length,
      pendingCents, invoicedCents, refundedCents,
    };
  });
  const totalPendingCents = billingByClient.reduce((s, b) => s + b.pendingCents, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Done-For-You Service</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{clients.filter((c) => c.status === "active").length}</p>
            <p className="text-xs text-muted-foreground">Active Clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <FileText className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{thisMonthRequests.length}</p>
            <p className="text-xs text-muted-foreground">This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold text-green-500">
              {formatCurrencyCents(totalPendingCents)}
            </p>
            <p className="text-xs text-muted-foreground">Pending Invoice</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">
            Requests {pendingCount > 0 && <Badge variant="destructive" className="ml-2 text-xs">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No requests yet
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const parsed = req.parsed_result || {};
                const burns = req.fuel_burns || [];
                const itineraryNum = parsed.itinerary_num;
                const aircraft = parsed.aircraft;
                return (
                <Card key={req.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{req.client?.company_name || "Unknown Client"}</p>
                        <p className="text-xs text-muted-foreground">
                          {req.client?.contact_email || "—"} ·{" "}
                          {new Date(req.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                            hour: "numeric", minute: "2-digit",
                          })}
                        </p>
                        {req.admin_notes && (
                          <p className="text-xs text-muted-foreground mt-1">Notes: {req.admin_notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Badge variant={statusColors[req.status] || "secondary"}>
                          {req.status}
                        </Badge>
                        {(req.status === "pending" || req.status === "processing") && (
                          <Button size="sm" variant="default" onClick={() => runStandardFlow(req)}>
                            <FileText className="h-3 w-3 mr-1" /> Run Standard Flow
                          </Button>
                        )}
                        {req.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => updateRequestStatus(req.id, "processing")}>
                            Start Processing
                          </Button>
                        )}
                        {req.status === "processing" && (
                          <Button size="sm" onClick={() => updateRequestStatus(req.id, "approved")}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve
                          </Button>
                        )}
                        {req.status === "approved" && (
                          <Button size="sm" onClick={() => updateRequestStatus(req.id, "sent")}>
                            <Send className="h-3 w-3 mr-1" /> Mark Sent &amp; Email Client
                          </Button>
                        )}
                        {(req.status === "pending" || req.status === "processing") && (
                          <Button size="sm" variant="destructive" onClick={() => updateRequestStatus(req.id, "rejected")}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Parsed itinerary + fuel data preview for the admin */}
                    <div className="rounded-md border bg-secondary/40 p-3 text-xs space-y-2">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span><span className="text-muted-foreground">Itinerary #:</span>{" "}
                          <span className="font-medium">{itineraryNum || "—"}</span></span>
                        <span><span className="text-muted-foreground">Aircraft:</span>{" "}
                          <span className="font-medium">{aircraft || "—"}</span></span>
                        <span><span className="text-muted-foreground">Fuel on board:</span>{" "}
                          <span className="font-medium">
                            {req.fuel_on_board_lbs != null ? `${req.fuel_on_board_lbs} lbs` : "—"}
                          </span></span>
                        {req.pdf_storage_path && (
                          <span className="text-muted-foreground truncate max-w-[260px]">
                            PDF: {req.pdf_storage_path.split("/").pop()}
                          </span>
                        )}
                      </div>
                      {burns.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {burns.map((b, i) => (
                            <span key={i} className="bg-background border rounded px-2 py-0.5">
                              L{b.leg} {b.departure}→{b.destination}: <strong>{b.fuel_burn_lbs}</strong> lbs
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No fuel burns provided.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Add Client</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add DFY Client</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Company Name *</Label>
                    <Input
                      value={newClient.company_name}
                      onChange={(e) => setNewClient({ ...newClient, company_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Contact Name</Label>
                    <Input
                      value={newClient.contact_name}
                      onChange={(e) => setNewClient({ ...newClient, contact_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Contact Email *</Label>
                    <Input
                      type="email"
                      value={newClient.contact_email}
                      onChange={(e) => setNewClient({ ...newClient, contact_email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Linked User Account *</Label>
                    <Select value={newClient.user_id} onValueChange={(v) => setNewClient({ ...newClient, user_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.email} {p.company ? `(${p.company})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Pricing Tier</Label>
                    <Select value={newClient.pricing_tier} onValueChange={(v) => setNewClient({ ...newClient, pricing_tier: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_trip">Per Trip ($25)</SelectItem>
                        <SelectItem value="monthly">Monthly (Custom)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={addClient} disabled={savingClient} className="w-full">
                    {savingClient ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Add Client
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {clients.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No DFY clients yet
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Company</th>
                    <th className="text-left px-4 py-2 font-medium">Contact</th>
                    <th className="text-center px-4 py-2 font-medium">Tier</th>
                    <th className="text-center px-4 py-2 font-medium">Status</th>
                    <th className="text-center px-4 py-2 font-medium">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => {
                    const reqCount = requests.filter((r) => r.client_id === c.id).length;
                    return (
                      <tr key={c.id} className="border-t hover:bg-secondary/50">
                        <td className="px-4 py-2 font-medium">{c.company_name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{c.contact_email}</td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant="outline">
                            {c.pricing_tier === "per_trip" ? `${formatCurrencyCents(c.per_trip_rate_cents)}/trip` : `${formatCurrencyCents(c.monthly_rate_cents)}/mo`}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge variant={c.status === "active" ? "default" : "secondary"}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-center">{reqCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">This Month's Billing Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {billingByClient.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No clients to bill</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Client</th>
                        <th className="text-center px-4 py-2 font-medium">Tier</th>
                        <th className="text-center px-4 py-2 font-medium">Trips</th>
                        <th className="text-right px-4 py-2 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingByClient.map((b) => (
                        <tr key={b.client.id} className="border-t">
                          <td className="px-4 py-2 font-medium">{b.client.company_name}</td>
                          <td className="px-4 py-2 text-center">
                            {b.client.pricing_tier === "per_trip" ? `${formatCurrencyCents(b.client.per_trip_rate_cents)}/trip` : `${formatCurrencyCents(b.client.monthly_rate_cents)}/mo`}
                          </td>
                          <td className="px-4 py-2 text-center">{b.tripsThisMonth}</td>
                          <td className="px-4 py-2 text-right text-green-500 font-medium">
                            {formatCurrency(b.revenue)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t bg-secondary/50 font-bold">
                        <td className="px-4 py-2" colSpan={3}>Total</td>
                        <td className="px-4 py-2 text-right text-green-500">
                          {formatCurrency(totalRevenue)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
