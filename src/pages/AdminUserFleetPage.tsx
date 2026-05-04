import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Plane, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AircraftRow {
  id: number;
  tail_number: string;
  manufacturer: string;
  type: string;
  is_enabled: boolean;
}

interface ProfileRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
}

export default function AdminUserFleetPage() {
  const { userId } = useParams<{ userId: string }>();
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const isAdmin = profile?.role_name === "Admin";

  const [target, setTarget] = useState<ProfileRow | null>(null);
  const [aircraft, setAircraft] = useState<AircraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AircraftRow | null>(null);

  useEffect(() => {
    if (!isAdmin || !userId) return;
    (async () => {
      setLoading(true);
      const [profRes, acRes] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, email, company").eq("id", userId).maybeSingle(),
        supabase.from("aircrafts")
          .select("id, tail_number, manufacturer, type, is_enabled")
          .eq("user_company", userId)
          .order("tail_number"),
      ]);
      setTarget((profRes.data as any) ?? null);
      setAircraft((acRes.data as any) ?? []);
      setLoading(false);
    })();
  }, [isAdmin, userId]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center p-8">
        <h1 className="text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Admin access required.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">Back to Dashboard</Button>
      </div>
    );
  }

  async function toggleAircraft(a: AircraftRow) {
    setBusyId(a.id);
    const { error } = await supabase
      .from("aircrafts")
      .update({ is_enabled: !a.is_enabled })
      .eq("id", a.id);
    setBusyId(null);
    if (error) {
      toast.error("Failed to update aircraft", { description: error.message });
      return;
    }
    setAircraft((prev) => prev.map((r) => r.id === a.id ? { ...r, is_enabled: !a.is_enabled } : r));
    toast.success(a.is_enabled ? `${a.tail_number} disabled` : `${a.tail_number} enabled`);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const a = pendingDelete;
    setBusyId(a.id);
    const { error } = await supabase.from("aircrafts").delete().eq("id", a.id);
    setBusyId(null);
    setPendingDelete(null);
    if (error) {
      toast.error("Failed to delete aircraft", { description: error.message });
      return;
    }
    setAircraft((prev) => prev.filter((r) => r.id !== a.id));
    toast.success(`${a.tail_number} removed`);
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Button>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plane className="h-6 w-6 text-primary" /> Fleet management
        </h1>
        {target ? (
          <p className="text-sm text-muted-foreground mt-1">
            Managing fleet for <strong className="text-foreground">{target.first_name} {target.last_name}</strong>
            {" "}({target.email}){target.company ? ` — ${target.company}` : ""}
          </p>
        ) : !loading ? (
          <p className="text-sm text-destructive mt-1">User not found.</p>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : aircraft.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              This user has no aircraft yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Tail #</th>
                  <th className="text-left px-4 py-2 font-medium">Manufacturer</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-center px-4 py-2 font-medium">Active in billing</th>
                  <th className="text-center px-4 py-2 font-medium w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {aircraft.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-2 font-mono">{a.tail_number}</td>
                    <td className="px-4 py-2 text-muted-foreground">{a.manufacturer || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{a.type || "—"}</td>
                    <td className="px-4 py-2 text-center">
                      <Switch
                        checked={a.is_enabled}
                        onCheckedChange={() => toggleAircraft(a)}
                        disabled={busyId === a.id}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-center gap-2">
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                          <Link to={`/aircraft/${a.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={busyId === a.id}
                          onClick={() => setPendingDelete(a)}
                        >
                          {busyId === a.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete aircraft {pendingDelete?.tail_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the aircraft from this user's fleet. Trips already
              flown remain unchanged. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete aircraft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
