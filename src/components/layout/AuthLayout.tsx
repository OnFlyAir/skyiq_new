import { Outlet } from 'react-router-dom';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-background px-4 py-10 sm:py-16 relative">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-skyiq-cyan/5 via-transparent to-skyiq-cyan/3 pointer-events-none" />

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center relative z-10">
        <img src={skyiqLogo} alt="SkyIQ" className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-md" />
      </div>

      {/* Auth card */}
      <div className="w-full max-w-md bg-card rounded-xl border border-border p-6 sm:p-10 relative z-10">
        <Outlet />
      </div>

      {/* Footer */}
      <footer className="mt-6 mb-2 text-center text-sm text-muted-foreground relative z-10">
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
