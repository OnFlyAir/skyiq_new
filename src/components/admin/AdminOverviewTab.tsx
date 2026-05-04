import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Building2, Loader2, Plane, Search, TrendingUp, CreditCard,
  MoreHorizontal, UserCheck, UserX, Trash2, DollarSign,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface CompanyRow {
  userId: string;
  company: string;
  name: string;
  email: string;
  tripsRun: number;
  tailNumbers: number;
  savings: number;
  isEnabled: boolean;
  billingExempt: boolean;
  roleName: string;
  subscriptionStatus: string;
  subscriptionTier: string;
}

export default function AdminOverviewTab() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<CompanyRow | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [profilesRes, tripsRes, aircraftRes, subsRes] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name, company, is_enabled, email, role_name, billing_exempt" as any),
      supabase.from("trips").select("user_company, savings"),
      supabase.from("aircrafts").select("user_company").eq("is_enabled", true),
      supabase.from("subscriptions").select("user_id, status, billing_cycle"),
    ]);

    const profiles = (profilesRes.data ?? []) as any[];
    const trips = tripsRes.data ?? [];
    const aircraft = aircraftRes.data ?? [];
    const subs = subsRes.data ?? [];

    const rows: CompanyRow[] = profiles.map((p) => {
      const userTrips = trips.filter((t) => t.user_company === p.id);
      const userAircraft = aircraft.filter((a) => a.user_company === p.id);
      const sub = subs.find((s) => s.user_id === p.id);

      return {
        userId: p.id,
        company: p.company || "—",
        name: `${p.first_name} ${p.last_name}`.trim() || "—",
        email: p.email,
        tripsRun: userTrips.length,
        tailNumbers: userAircraft.length,
        savings: userTrips.reduce((sum, t) => sum + (t.savings ?? 0), 0),
        isEnabled: p.is_enabled ?? true,
        billingExempt: !!p.billing_exempt,
        roleName: p.role_name ?? "User",
        subscriptionStatus: sub?.status ?? "none",
        subscriptionTier: sub?.billing_cycle ?? "—",
      };
    });

    setCompanies(rows);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const filtered = companies.filter(
    (c) =>
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()),
  );

  const totalTrips = companies.reduce((s, c) => s + c.tripsRun, 0);
  const totalSavings = companies.reduce((s, c) => s + c.savings, 0);

  const subStatusColor = (status: string) => {
    if (status === "active") return "default" as const;
    if (status === "trial") return "outline" as const;
    if (status === "canceled" || status === "expired") return "destructive" as const;
    return "secondary" as const;
  };

  async function toggleEnabled(c: CompanyRow) {
    setBusyId(c.userId);
    const { error } = await supabase
      .from("profiles")
      .update({ is_enabled: !c.isEnabled } as any)
      .eq("id", c.userId);
    setBusyId(null);
    if (error) {
      toast.error("Failed to update account", { description: error.message });
      return;
    }
    toast.success(c.isEnabled ? "Account deactivated" : "Account activated");
    setCompanies((prev) => prev.map((r) => r.userId === c.userId ? { ...r, isEnabled: !c.isEnabled } : r));
  }

  async function toggleBillingExempt(c: CompanyRow) {
    setBusyId(c.userId);
    const { error } = await supabase
      .from("profiles")
      .update({ billing_exempt: !c.billingExempt } as any)
      .eq("id", c.userId);
    setBusyId(null);
    if (error) {
      toast.error("Failed to update billing", { description: error.message });
      return;
    }
    toast.success(c.billingExempt ? "Billing re-enabled" : "Billing disabled (exempt)");
    setCompanies((prev) => prev.map((r) => r.userId === c.userId ? { ...r, billingExempt: !c.billingExempt } : r));
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    setBusyId(target.userId);
    const toastId = toast.loading(`Deleting ${target.email}…`, {
      description: "Removing profile, aircraft, trips, subscription, and login.",
    });
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { target_user_id: target.userId },
      });
      // Edge function may return a non-2xx with an error payload — surface it.
      const apiError = (data as any)?.error;
      if (error || apiError) {
        const message = apiError || error?.message || "Unknown error";
        const ctx = (error as any)?.context;
        const status = ctx?.status ? ` (HTTP ${ctx.status})` : "";
        toast.error(`Failed to delete ${target.email}`, {
          id: toastId,
          description: `${message}${status}. No changes were saved.`,
          duration: 8000,
        });
        return;
      }
      toast.success(`Deleted ${target.email}`, {
        id: toastId,
        description: "All associated data has been permanently removed.",
      });
      setCompanies((prev) => prev.filter((r) => r.userId !== target.userId));
      setPendingDelete(null);
      setConfirmText("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      toast.error(`Failed to delete ${target.email}`, {
        id: toastId,
        description: `${message}. Please try again.`,
        duration: 8000,
      });
    } finally {
      setDeleting(false);
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Building2 className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{companies.length}</p>
            <p className="text-xs text-muted-foreground">Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Plane className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{totalTrips}</p>
            <p className="text-xs text-muted-foreground">Total Trips</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <CreditCard className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">
              {companies.filter((c) => c.subscriptionStatus === "active" || c.subscriptionStatus === "trial").length}
            </p>
            <p className="text-xs text-muted-foreground">Active Subs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalSavings)}
            </p>
            <p className="text-xs text-muted-foreground">Total Savings</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by company, name, or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Company</th>
                <th className="text-left px-4 py-2 font-medium">Contact</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-center px-4 py-2 font-medium">Trips</th>
                <th className="text-center px-4 py-2 font-medium">Tails</th>
                <th className="text-right px-4 py-2 font-medium">Savings</th>
                <th className="text-center px-4 py-2 font-medium">Subscription</th>
                <th className="text-center px-4 py-2 font-medium">Billing</th>
                <th className="text-center px-4 py-2 font-medium">Status</th>
                <th className="text-center px-4 py-2 font-medium w-12">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.userId} className="border-t hover:bg-secondary/50">
                  <td className="px-4 py-2 font-medium">{c.company}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.name}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{c.email}</td>
                  <td className="px-4 py-2 text-center">{c.tripsRun}</td>
                  <td className="px-4 py-2 text-center">
                    <Link to={`/admin/users/${c.userId}/fleet`} className="text-primary hover:underline">
                      {c.tailNumbers}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right text-green-600 font-medium">
                    {formatCurrency(c.savings)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant={subStatusColor(c.subscriptionStatus)}>
                      {c.subscriptionStatus === "none" ? "No Sub" : c.subscriptionStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={!c.billingExempt}
                        onCheckedChange={() => toggleBillingExempt(c)}
                        disabled={busyId === c.userId || c.roleName === "Admin" || c.roleName === "Dev"}
                        aria-label="Bill this user"
                      />
                      <span className="text-xs text-muted-foreground">
                        {c.billingExempt || c.roleName === "Admin" || c.roleName === "Dev" ? "Exempt" : "On"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant={c.isEnabled ? "default" : "secondary"}>
                      {c.isEnabled ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busyId === c.userId}>
                          {busyId === c.userId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => toggleEnabled(c)}>
                          {c.isEnabled ? (
                            <><UserX className="h-4 w-4 mr-2" /> Deactivate account</>
                          ) : (
                            <><UserCheck className="h-4 w-4 mr-2" /> Activate account</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleBillingExempt(c)}
                          disabled={c.roleName === "Admin" || c.roleName === "Dev"}>
                          <DollarSign className="h-4 w-4 mr-2" />
                          {c.billingExempt ? "Resume billing" : "Mark billing-exempt"}
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/users/${c.userId}/fleet`}>
                            <Plane className="h-4 w-4 mr-2" /> Manage aircraft fleet
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setPendingDelete(c)}
                          className="text-destructive focus:text-destructive"
                          disabled={c.roleName === "Admin"}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete user
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{pendingDelete?.email}</strong> and all of their
              data — profile, aircraft, trips, subscription, and login. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
