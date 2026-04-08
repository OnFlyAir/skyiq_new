import { useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { Plane, Menu, X, Home, Settings, DollarSign, LogOut, Search } from 'lucide-react';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

export default function AppLayout() {
  const { profile, signOut } = useAuthContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: Home, path: '/dashboard' },
    { label: 'Plan a Trip', icon: Plane, path: '/trips/new' },
    { label: 'Manage Fleet', icon: Settings, path: '/fleet' },
    { label: 'Savings Accrued', icon: DollarSign, path: '/savings' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-card border-r border-border transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <img src={skyiqLogo} alt="SkyIQ" className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold text-foreground tracking-tight">SkyIQ</span>
              <span className="text-xs text-muted-foreground font-medium">Fly Smarter</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-secondary rounded text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search Tail # / Trip" className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" />
            </div>
          </div>

          <nav className="flex-1 px-3">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg mb-1 transition-colors ${isActive(item.path) ? 'bg-primary/15 text-primary font-medium border border-primary/20' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-border p-4">
            <Link to="/profile" className="flex items-center gap-3 mb-3 p-2 rounded-lg hover:bg-secondary transition-colors">
              <div className="w-8 h-8 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-semibold">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-xs text-muted-foreground">{profile?.role_name}</p>
              </div>
            </Link>
            <button onClick={handleSignOut} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 hover:bg-secondary rounded text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <img src={skyiqLogo} alt="SkyIQ" className="w-8 h-8 object-contain" />
          <div className="w-8" />
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
