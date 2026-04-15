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

interface DfyRequest {
  id: string;
  client_id: string;
  status: string;
  pdf_storage_path: string | null;
  admin_notes: string;
  created_at: string;
  reviewed_at: string | null;
  sent_at: string | null;
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

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  async function loadData() {
    const [clientsRes, requestsRes, profilesRes] = await Promise.all([
      supabase.from("dfy_clients" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("dfy_requests" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, company"),
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
    toast({ title: `Request marked as ${status}` });
    loadData();
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

  // Billing summary
  const billingByClient = clients.map((c) => {
    const clientReqs = requests.filter((r) => r.client_id === c.id && (r.status === "sent" || r.status === "approved"));
    const monthReqs = clientReqs.filter((r) => {
      const d = new Date(r.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const revenue = c.pricing_tier === "per_trip"
      ? monthReqs.length * (c.per_trip_rate_cents / 100)
      : c.monthly_rate_cents / 100;
    return { client: c, tripsThisMonth: monthReqs.length, revenue };
  });

  const totalRevenue = billingByClient.reduce((s, b) => s + b.revenue, 0);

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
              ${totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground">Est. Revenue</p>
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
              {requests.map((req) => (
                <Card key={req.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{req.client?.company_name || "Unknown Client"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                            hour: "numeric", minute: "2-digit",
                          })}
                        </p>
                        {req.admin_notes && (
                          <p className="text-xs text-muted-foreground mt-1">Notes: {req.admin_notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusColors[req.status] || "secondary"}>
                          {req.status}
                        </Badge>
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
                            <Send className="h-3 w-3 mr-1" /> Mark Sent
                          </Button>
                        )}
                        {(req.status === "pending" || req.status === "processing") && (
                          <Button size="sm" variant="destructive" onClick={() => updateRequestStatus(req.id, "rejected")}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                            {c.pricing_tier === "per_trip" ? "$200/trip" : "$10K/mo"}
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
                            {b.client.pricing_tier === "per_trip" ? "$200/trip" : "$10K/mo"}
                          </td>
                          <td className="px-4 py-2 text-center">{b.tripsThisMonth}</td>
                          <td className="px-4 py-2 text-right text-green-500 font-medium">
                            ${b.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t bg-secondary/50 font-bold">
                        <td className="px-4 py-2" colSpan={3}>Total</td>
                        <td className="px-4 py-2 text-right text-green-500">
                          ${totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
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
