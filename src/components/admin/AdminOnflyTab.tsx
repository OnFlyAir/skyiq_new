import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Download, Database, RefreshCw, Pencil, Check, X, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OnflyRow {
  id: string;
  trip_id: number | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  itinerary_num: string;
  parsed_at: string;
  pdf_storage_path: string | null;
}

export default function AdminOnflyTab() {
  const [data, setData] = useState<OnflyRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ client_name: "", client_email: "", client_phone: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("onfly_data")
      .select("id, trip_id, client_name, client_email, client_phone, itinerary_num, parsed_at, pdf_storage_path")
      .order("parsed_at", { ascending: false });

    if (!error) {
      setData((rows ?? []) as unknown as OnflyRow[]);
    }
    setLoading(false);
  }

  function startEdit(row: OnflyRow) {
    setEditingId(row.id);
    setEditValues({
      client_name: row.client_name || "",
      client_email: row.client_email || "",
      client_phone: row.client_phone || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({ client_name: "", client_email: "", client_phone: "" });
  }

  async function saveEdit(id: string) {
    const name = editValues.client_name.trim().slice(0, 200);
    const email = editValues.client_email.trim().slice(0, 255);
    const phone = editValues.client_phone.trim().slice(0, 30);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Invalid email format", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("onfly_data")
      .update({ client_name: name, client_email: email, client_phone: phone } as any)
      .eq("id", id);

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }

    setData((prev) =>
      prev.map((r) => (r.id === id ? { ...r, client_name: name, client_email: email, client_phone: phone } : r)),
    );
    setEditingId(null);
    toast({ title: "Updated" });
  }

  async function downloadPdf(storagePath: string) {
    const { data: blob, error } = await supabase.storage
      .from("itinerary-pdfs")
      .download(storagePath);

    if (error || !blob) {
      toast({ title: "Download failed", description: error?.message, variant: "destructive" });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = storagePath.split("/").pop() || "itinerary.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function syncFromTrips() {
    setSyncing(true);
    try {
      const { data: trips } = await supabase
        .from("trips")
        .select("id, itinerary_num, itinerary_details, user_company");

      if (!trips) {
        toast({ title: "No trips found", variant: "destructive" });
        setSyncing(false);
        return;
      }

      // Get existing trip_ids to skip duplicates
      const { data: existingRows } = await supabase
        .from("onfly_data")
        .select("trip_id");

      const existingTripIds = new Set((existingRows ?? []).map((r: any) => r.trip_id).filter(Boolean));

      let inserted = 0;
      for (const trip of trips) {
        if (existingTripIds.has(trip.id)) continue;

        const details = trip.itinerary_details as any;
        const clientName = details?.client_name || details?.passenger_name || "";
        const clientEmail = details?.client_email || details?.email || "";
        const clientPhone = details?.client_phone || details?.phone || "";

        await supabase.from("onfly_data").insert({
          trip_id: trip.id,
          user_id: trip.user_company || "00000000-0000-0000-0000-000000000000",
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone,
          itinerary_num: trip.itinerary_num || "",
          raw_itinerary: trip.itinerary_details || {},
        } as any);
        inserted++;
      }

      toast({ title: `Synced ${inserted} new trip(s) to OnFly Data` });
      await loadData();
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    }
    setSyncing(false);
  }

  function exportCsv() {
    const headers = ["Itinerary #", "Client Name", "Client Email", "Client Phone", "Trip ID", "Parsed Date", "Has PDF"];
    const rows = filtered.map((r) => [
      r.itinerary_num,
      r.client_name,
      r.client_email,
      r.client_phone,
      r.trip_id?.toString() ?? "",
      new Date(r.parsed_at).toLocaleDateString(),
      r.pdf_storage_path ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OnFly_Data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = data.filter(
    (r) =>
      r.client_name.toLowerCase().includes(search.toLowerCase()) ||
      r.client_email.toLowerCase().includes(search.toLowerCase()) ||
      r.itinerary_num.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">OnFly Data</h2>
          <Badge variant="outline">{data.length} records</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={syncFromTrips} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync from Trips"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={data.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, email, or itinerary #..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No OnFly Data yet. Click "Sync from Trips" to import existing trip itineraries.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Itinerary #</th>
                <th className="text-left px-4 py-2 font-medium">Client Name</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Phone</th>
                <th className="text-center px-4 py-2 font-medium">Trip ID</th>
                <th className="text-center px-4 py-2 font-medium">PDF</th>
                <th className="text-right px-4 py-2 font-medium">Parsed</th>
                <th className="text-center px-4 py-2 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isEditing = editingId === r.id;
                return (
                  <tr key={r.id} className="border-t hover:bg-secondary/50">
                    <td className="px-4 py-2 font-medium">{r.itinerary_num || "—"}</td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <Input
                          value={editValues.client_name}
                          onChange={(e) => setEditValues({ ...editValues, client_name: e.target.value })}
                          className="h-7 text-xs"
                          maxLength={200}
                        />
                      ) : (
                        r.client_name || "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {isEditing ? (
                        <Input
                          value={editValues.client_email}
                          onChange={(e) => setEditValues({ ...editValues, client_email: e.target.value })}
                          className="h-7 text-xs"
                          type="email"
                          maxLength={255}
                        />
                      ) : (
                        r.client_email || "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {isEditing ? (
                        <Input
                          value={editValues.client_phone}
                          onChange={(e) => setEditValues({ ...editValues, client_phone: e.target.value })}
                          className="h-7 text-xs"
                          maxLength={30}
                        />
                      ) : (
                        r.client_phone || "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">{r.trip_id ?? "—"}</td>
                    <td className="px-4 py-2 text-center">
                      {r.pdf_storage_path ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => downloadPdf(r.pdf_storage_path!)}
                          title="Download PDF"
                        >
                          <FileDown className="h-3.5 w-3.5 text-primary" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {new Date(r.parsed_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(r.id)} disabled={saving}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} disabled={saving}>
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">No matching records</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
