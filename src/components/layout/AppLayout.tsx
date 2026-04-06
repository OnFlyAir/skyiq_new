import { useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { Plane, Menu, X, Home, Settings, DollarSign, LogOut } from 'lucide-react';
import skyiqLogoText from '@/assets/skyiq-logo-text.png';

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
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-card border-r border-border transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src={skyiqLogoText} alt="SkyIQ" className="h-8 object-contain" />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-muted rounded"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4">
            <input
              type="text"
              placeholder="Search Tail #/Trip"
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg mb-1 transition-colors ${
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* User section */}
          <div className="border-t border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{profile?.role?.replace('_', ' ')}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 hover:bg-muted rounded text-muted-foreground"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 hover:bg-muted rounded"
          >
            <Menu className="w-6 h-6 text-foreground" />
          </button>
          <img src={skyiqLogoText} alt="SkyIQ" className="h-6 object-contain" />
          <div className="w-6" />
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
