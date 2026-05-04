import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ScrollText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";

interface AuditRow {
  id: string;
  actor_id: string;
  actor_email: string | null;
  action: string;
  target_user_id: string | null;
  target_label: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; tone: "default" | "destructive" | "secondary" | "outline" }> = {
  "user.activate": { label: "Activated account", tone: "default" },
  "user.deactivate": { label: "Deactivated account", tone: "secondary" },
  "user.billing_exempt_on": { label: "Marked billing-exempt", tone: "outline" },
  "user.billing_exempt_off": { label: "Resumed billing", tone: "outline" },
  "user.delete": { label: "Deleted user", tone: "destructive" },
  "fleet.aircraft_update": { label: "Updated aircraft", tone: "outline" },
  "fleet.aircraft_enable": { label: "Enabled aircraft", tone: "default" },
  "fleet.aircraft_disable": { label: "Disabled aircraft", tone: "secondary" },
  "fleet.aircraft_delete": { label: "Deleted aircraft", tone: "destructive" },
};

export default function AdminAuditLogTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("admin_audit_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows(((data as any) ?? []) as AuditRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.actor_email?.toLowerCase().includes(q) ||
      r.target_label?.toLowerCase().includes(q) ||
      r.action.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter by admin, target, or action…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" size="icon" onClick={load} aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No audit entries yet.
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-2 font-medium">When</th>
                <th className="text-left px-4 py-2 font-medium">Admin</th>
                <th className="text-left px-4 py-2 font-medium">Action</th>
                <th className="text-left px-4 py-2 font-medium">Target</th>
                <th className="text-left px-4 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = ACTION_LABELS[r.action] ?? { label: r.action, tone: "outline" as const };
                return (
                  <tr key={r.id} className="border-t align-top hover:bg-secondary/40">
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-2 text-xs">{r.actor_email ?? r.actor_id.slice(0, 8)}</td>
                    <td className="px-4 py-2">
                      <Badge variant={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-2 text-xs">{r.target_label ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground font-mono max-w-md truncate">
                      {Object.keys(r.details).length === 0 ? "—" : JSON.stringify(r.details)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
