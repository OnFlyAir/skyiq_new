import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, Plane, Search, TrendingUp, CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface CompanyRow {
  userId: string;
  company: string;
  name: string;
  email: string;
  tripsRun: number;
  tailNumbers: number;
  savings: number;
  isEnabled: boolean;
  subscriptionStatus: string;
  subscriptionTier: string;
}

export default function AdminOverviewTab() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [profilesRes, tripsRes, aircraftRes, subsRes] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, company, is_enabled, email"),
        supabase.from("trips").select("user_company, savings"),
        supabase.from("aircrafts").select("user_company").eq("is_enabled", true),
        supabase.from("subscriptions").select("user_id, status, billing_cycle"),
      ]);

      const profiles = profilesRes.data ?? [];
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
          subscriptionStatus: sub?.status ?? "none",
          subscriptionTier: sub?.billing_cycle ?? "—",
        };
      });

      setCompanies(rows);
      setLoading(false);
    }
    loadData();
  }, []);

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
              ${totalSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
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
        <div className="rounded-lg border overflow-hidden">
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
                <th className="text-center px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.userId} className="border-t hover:bg-secondary/50">
                  <td className="px-4 py-2 font-medium">{c.company}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.name}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{c.email}</td>
                  <td className="px-4 py-2 text-center">{c.tripsRun}</td>
                  <td className="px-4 py-2 text-center">{c.tailNumbers}</td>
                  <td className="px-4 py-2 text-right text-green-600 font-medium">
                    ${c.savings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant={subStatusColor(c.subscriptionStatus)}>
                      {c.subscriptionStatus === "none" ? "No Sub" : c.subscriptionStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant={c.isEnabled ? "default" : "secondary"}>
                      {c.isEnabled ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
