import { Fuel, Plane, MapPin, TrendingUp, Clock, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const recentFlights = [
  { id: 1, route: "KJFK → KLAX", aircraft: "B737-800", fuel: "18,420 kg", date: "Today", status: "Planned" },
  { id: 2, route: "KLAX → KORD", aircraft: "A320neo", fuel: "12,850 kg", date: "Yesterday", status: "Completed" },
  { id: 3, route: "KORD → KATL", aircraft: "B737 MAX", fuel: "8,200 kg", date: "Apr 3", status: "Completed" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Fuel className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">SKYIQ</h1>
              <p className="text-xs text-muted-foreground">Fuel Planning Intelligence</p>
            </div>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Flight Plan
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Plane className="h-5 w-5" />}
            label="Flights Today"
            value="12"
            change="+3 from yesterday"
          />
          <StatCard
            icon={<Fuel className="h-5 w-5" />}
            label="Total Fuel Planned"
            value="142,800 kg"
            change="Across all flights"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Fuel Savings"
            value="4.2%"
            change="vs. standard uplift"
            highlight
          />
          <StatCard
            icon={<MapPin className="h-5 w-5" />}
            label="Active Routes"
            value="8"
            change="3 international"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent Flight Plans */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">Recent Flight Plans</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                View all <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentFlights.map((flight) => (
                <div
                  key={flight.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Plane className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{flight.route}</p>
                      <p className="text-sm text-muted-foreground">{flight.aircraft} · {flight.fuel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge
                        variant={flight.status === "Planned" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {flight.status}
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{flight.date}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions & Fuel Overview */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Plus className="h-4 w-4 text-primary" />
                  Create Flight Plan
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Fuel className="h-4 w-4 text-primary" />
                  Fuel Price Check
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  Route Analysis
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Clock className="h-4 w-4 text-primary" />
                  Weather Brief
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Fuel Budget</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-muted-foreground">Monthly Usage</span>
                    <span className="font-medium text-foreground">68%</span>
                  </div>
                  <Progress value={68} className="h-2" />
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-muted-foreground">Cost vs Budget</span>
                    <span className="font-medium text-foreground">54%</span>
                  </div>
                  <Progress value={54} className="h-2" />
                </div>
                <p className="text-xs text-muted-foreground">
                  $1.2M remaining of $2.2M monthly budget
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  change,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
  highlight?: boolean;
}) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${highlight ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{change}</p>
    </CardContent>
  </Card>
);

export default Index;
