import { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useDemo } from '@/contexts/DemoContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Plane,
  Menu,
  X,
  Home,
  Settings,
  DollarSign,
  LogOut,
  Search,
  CreditCard,
  Shield,
  Database,
  Wrench,
  ChevronRight,
  Sun,
  Moon,
  FileText,
  Play,
  AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: string;
  description?: string;
  activeMatch?: (pathname: string, search: string) => boolean;
  demoTarget?: string;
  badgeCount?: number;
  badgeTone?: 'danger' | 'default';
};

export default function AppLayout() {
  const { profile, signOut } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const { endDemo } = useDemo();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch recent trips for sidebar
  const [recentTrips, setRecentTrips] = useState<{ id: number; itinerary_num: string | null; created_on: string | null }[]>([]);
  useEffect(() => {
    if (!profile) return;
    supabase
      .from('trips')
      .select('id, itinerary_num, created_on')
      .order('created_on', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setRecentTrips(data); });
  }, [profile]);

  // Admin: track unacknowledged billing email failures for sidebar badge
  const [emailAlertCount, setEmailAlertCount] = useState(0);
  useEffect(() => {
    if (profile?.role_name !== 'Admin') return;
    let cancelled = false;
    const refresh = async () => {
      const { count } = await supabase
        .from('billing_email_log' as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .eq('acknowledged', false);
      if (!cancelled) setEmailAlertCount(count ?? 0);
    };
    refresh();
    const channel = supabase
      .channel('billing_email_log_badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'billing_email_log' }, refresh)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isAdmin = profile?.role_name === 'Admin';
  const displayName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || profile?.email || 'Account';
  const initials = (`${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}` || 'A').toUpperCase();

  const adminNavItems: NavItem[] = [
    {
      label: 'Admin Overview',
      icon: Shield,
      to: '/admin',
      description: 'Users, subscriptions, and platform activity',
      activeMatch: (pathname, search) => pathname === '/admin' && new URLSearchParams(search).get('tab') !== 'onfly',
    },
    {
      label: 'OnFly Data',
      icon: Database,
      to: '/admin?tab=onfly',
      description: 'Uploaded itineraries and parsed client details',
      activeMatch: (pathname, search) => pathname === '/admin' && new URLSearchParams(search).get('tab') === 'onfly',
    },
    {
      label: 'DFY Service',
      icon: Wrench,
      to: '/admin/dfy',
      description: 'Requests, clients, and fuel burn delivery',
    },
    {
      label: 'Subscriptions',
      icon: CreditCard,
      to: '/admin/subscriptions',
      description: 'Billing status and account management',
    },
    {
      label: 'Email Alerts',
      icon: AlertTriangle,
      to: '/admin/email-log',
      description: 'Failed billing email notifications',
      badgeCount: emailAlertCount,
      badgeTone: 'danger',
    },
  ];

  const flightToolsNavItems: NavItem[] = [
    { label: 'Dashboard', icon: Home, to: '/dashboard', demoTarget: 'nav-dashboard' },
    { label: 'Plan a Trip', icon: Plane, to: '/trips/new', demoTarget: 'nav-plan-trip' },
    { label: 'Manage Fleet', icon: Settings, to: '/fleet', demoTarget: 'nav-fleet' },
    { label: 'Fuel Planning (DFY)', icon: Wrench, to: '/dfy', description: '$25 / plan · we build it for you' },
    { label: 'Savings Accrued', icon: DollarSign, to: '/savings' },
    { label: 'Subscription', icon: CreditCard, to: '/subscription' },
  ];

  const isItemActive = (item: NavItem) =>
    item.activeMatch ? item.activeMatch(location.pathname, location.search) : location.pathname === item.to;

  const renderNavSection = (title: string, items: NavItem[]) => (
    <div className="mb-6">
      <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
        {title}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const active = isItemActive(item);

          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              data-demo={item.demoTarget}
              className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                active
                  ? 'border-primary/20 bg-primary/12 text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <item.icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium flex items-center gap-2">
                  {item.label}
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <span
                      className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                        item.badgeTone === 'danger'
                          ? 'bg-destructive text-destructive-foreground animate-pulse'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </span>
                  ) : null}
                </p>
                {item.description ? (
                  <p className={`text-[11px] leading-relaxed ${active ? 'text-primary/80' : 'text-muted-foreground/80'}`}>
                    {item.description}
                  </p>
                ) : null}
              </div>
              {active ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 transform border-r border-border bg-card transition-transform duration-200 ease-in-out lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="space-y-4 border-b border-border p-5">
            <div className="flex items-center justify-between">
              <Link to={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-2.5">
                <img src={skyiqLogo} alt="SkyIQ" className="h-8 w-8 object-contain" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold tracking-tight text-foreground">SkyIQ</span>
                    {isAdmin ? (
                      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                        Admin
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {isAdmin ? 'Platform Control Center' : 'Fly Smarter'}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-secondary lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={isAdmin ? 'Search user / itinerary / trip' : 'Search Tail # / Trip'}
                className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-9 pr-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {isAdmin ? (
              <>
                {renderNavSection('Admin Console', adminNavItems)}
                {renderNavSection('Flight Tools', flightToolsNavItems)}
              </>
            ) : (
              renderNavSection('Workspace', flightToolsNavItems)
            )}

            {recentTrips.length > 0 && (
              <div className="mb-6">
                <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                  Recent Trips
                </p>
                <div className="space-y-1">
                  {recentTrips.map((trip) => {
                    const tripPath = `/trips/${trip.id}/summary`;
                    const active = location.pathname.includes(`/trips/${trip.id}`);
                    const label = trip.itinerary_num || `Trip #${trip.id}`;
                    return (
                      <Link
                        key={trip.id}
                        to={tripPath}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                          active
                            ? 'border-primary/20 bg-primary/12 text-primary'
                            : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm font-medium">{label}</span>
                        {active && <ChevronRight className="ml-auto h-4 w-4 shrink-0" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          <div className="space-y-3 border-t border-border p-4">
            <Link
              to="/profile"
              className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                isAdmin ? 'border-primary/20 bg-primary/10 hover:bg-primary/15' : 'border-border/60 hover:bg-secondary'
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                  isAdmin ? 'bg-primary text-primary-foreground' : 'bg-primary/20 text-primary'
                }`}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isAdmin ? 'Administrator · Internal tools enabled' : profile?.role_name || 'User'}
                </p>
              </div>
              {isAdmin ? <Shield className="h-4 w-4 shrink-0 text-primary" /> : null}
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { endDemo(); navigate('/dashboard'); }}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Play className="h-4 w-4" /> Demos
              </button>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
            </div>

            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <PaymentTestModeBanner />
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card p-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary">
            <Menu className="h-5 w-5" />
          </button>
          <img src={skyiqLogo} alt="SkyIQ" className="h-8 w-8 object-contain" />
          <div className="w-8" />
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
