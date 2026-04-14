import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminOverviewTab from "@/components/admin/AdminOverviewTab";
import AdminOnflyTab from "@/components/admin/AdminOnflyTab";

export default function AdminDashboardPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const isAdmin = profile?.role_name === "Admin";

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
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/dfy")}>DFY Service</Button>
          <Button variant="outline" onClick={() => navigate("/admin/subscriptions")}>Manage Subscriptions</Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Users & Stats</TabsTrigger>
          <TabsTrigger value="onfly">OnFly Data</TabsTrigger>
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
