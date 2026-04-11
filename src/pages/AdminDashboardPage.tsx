// AdminDashboardPage — Super admin platform overview.
// Route: /admin
// Shows company-level stats: companies, trips, tails, savings.
// Mirrors the original UserController.Companies view.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Loader2, Plane, Search, TrendingUp } from "lucide-react";

interface CompanyRow {
  userId: string;
  company: string;
  name: string;
  tripsRun: number;
  tailNumbers: number;
  savings: number;
  isEnabled: boolean;
}

export default function AdminDashboardPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role_name === "Admin";

  useEffect(() => {
    if (!isAdmin) return;

    async function loadData() {
      // Fetch all profiles (companies)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company, is_enabled");

      // Fetch all trips
      const { data: trips } = await supabase
        .from("trips")
        .select("user_company, savings");

      // Fetch all aircraft
      const { data: aircraft } = await supabase
        .from("aircrafts")
        .select("user_company")
        .eq("is_enabled", true);

      const rows: CompanyRow[] = (profiles ?? []).map((p) => {
        const userTrips = (trips ?? []).filter((t) => t.user_company === p.id);
        const userAircraft = (aircraft ?? []).filter((a) => a.user_company === p.id);

        return {
          userId: p.id,
          company: p.company || "—",
          name: `${p.first_name} ${p.last_name}`.trim() || "—",
          tripsRun: userTrips.length,
          tailNumbers: userAircraft.length,
          savings: userTrips.reduce((sum, t) => sum + (t.savings ?? 0), 0),
          isEnabled: p.is_enabled,
        };
      });

      setCompanies(rows);
      setLoading(false);
    }
    loadData();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center p-8">
        <h1 className="text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Admin access required.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const filtered = companies.filter(
    (c) =>
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalTrips = companies.reduce((s, c) => s + c.tripsRun, 0);
  const totalTails = companies.reduce((s, c) => s + c.tailNumbers, 0);
  const totalSavings = companies.reduce((s, c) => s + c.savings, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Platform Overview</h1>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Building2 className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{companies.length}</p>
            <p className="text-xs text-muted-foreground">Companies</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Plane className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{totalTrips}</p>
            <p className="text-xs text-muted-foreground">Trips Run</p>
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
        <Input
          placeholder="Search company or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Company Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Company</th>
                <th className="text-left px-4 py-2 font-medium">Contact</th>
                <th className="text-center px-4 py-2 font-medium">Trips</th>
                <th className="text-center px-4 py-2 font-medium">Tails</th>
                <th className="text-right px-4 py-2 font-medium">Savings</th>
                <th className="text-center px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.userId} className="border-t hover:bg-muted">
                  <td className="px-4 py-2 font-medium">{c.company}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.name}</td>
                  <td className="px-4 py-2 text-center">{c.tripsRun}</td>
                  <td className="px-4 py-2 text-center">{c.tailNumbers}</td>
                  <td className="px-4 py-2 text-right text-green-600 font-medium">
                    ${c.savings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
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
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No companies found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
