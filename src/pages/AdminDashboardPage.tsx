import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import AdminOverviewTab from "@/components/admin/AdminOverviewTab";
import AdminOnflyTab from "@/components/admin/AdminOnflyTab";
import {
  Shield, Users, Plane, TrendingUp, CreditCard,
  Wrench, Database, BarChart3,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function AdminDashboardPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = profile?.role_name === "Admin";
  const activeTab = searchParams.get("tab") === "onfly" ? "onfly" : "overview";

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTrips: 0,
    activeSubs: 0,
    totalSavings: 0,
    onflyRecords: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    async function loadStats() {
      const [profilesRes, tripsRes, subsRes, onflyRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("trips").select("savings"),
        supabase.from("subscriptions").select("status"),
        supabase.from("onfly_data").select("id", { count: "exact", head: true }),
      ]);

      const trips = tripsRes.data ?? [];
      const subs = subsRes.data ?? [];

      setStats({
        totalUsers: profilesRes.count ?? 0,
        totalTrips: trips.length,
        activeSubs: subs.filter((s) => s.status === "active" || s.status === "trial").length,
        totalSavings: trips.reduce((sum, t) => sum + ((t as any).savings ?? 0), 0),
        onflyRecords: onflyRes.count ?? 0,
      });
      setLoading(false);
    }
    loadStats();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center p-8">
        <h1 className="text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Admin access required.</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/15 rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">
              Logged in as {profile?.first_name} {profile?.last_name} · <Badge variant="outline" className="text-xs">Admin</Badge>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/dfy")}>
            <Wrench className="h-4 w-4 mr-2" /> DFY Service
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/subscriptions")}>
            <CreditCard className="h-4 w-4 mr-2" /> Manage Subscriptions
          </Button>
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Plane className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{stats.totalTrips}</p>
              <p className="text-xs text-muted-foreground">Total Trips</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <CreditCard className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{stats.activeSubs}</p>
              <p className="text-xs text-muted-foreground">Active Subs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <p className="text-2xl font-bold text-green-600">
                ${stats.totalSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground">Total Savings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Database className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{stats.onflyRecords}</p>
              <p className="text-xs text-muted-foreground">OnFly Records</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value }, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-1" /> Users & Stats
          </TabsTrigger>
          <TabsTrigger value="onfly">
            <Database className="h-4 w-4 mr-1" /> OnFly Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverviewTab />
        </TabsContent>

        <TabsContent value="onfly">
          <AdminOnflyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
