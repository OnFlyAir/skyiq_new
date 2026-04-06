import { Outlet } from 'react-router-dom';
import { Plane } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-skyiq-cyan/5 via-transparent to-skyiq-cyan/3" />

      {/* Logo */}
      <div className="mb-10 flex items-center gap-2 relative z-10">
        <Plane className="w-7 h-7 text-primary" />
        <span className="text-2xl font-bold text-foreground tracking-tight">SkyIQ</span>
      </div>

      {/* Auth card */}
      <div className="w-full max-w-md bg-card rounded-xl border border-border p-10 relative z-10">
        <Outlet />
      </div>

      {/* Footer */}
      <footer className="mt-10 text-center text-sm text-muted-foreground relative z-10">
        <p>
          Need help?{' '}
          <a href="mailto:info@skyiq.net" className="text-primary hover:underline font-medium">
            info@skyiq.net
          </a>
        </p>
      </footer>
    </div>
  );
}
