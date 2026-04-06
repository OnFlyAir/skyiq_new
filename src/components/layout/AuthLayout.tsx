import { Outlet } from 'react-router-dom';
import skyiqLogoDark from '@/assets/skyiq-logo-dark.png';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <img src={skyiqLogoDark} alt="SkyIQ" className="w-28 h-28 object-contain mb-2" />
      </div>

      {/* Auth card */}
      <div className="w-full max-w-md bg-card rounded-xl shadow-lg border border-border p-8">
        <Outlet />
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          For account support: <a href="mailto:info@skyiq.net" className="text-primary hover:underline">info@skyiq.net</a>
        </p>
      </footer>
    </div>
  );
}
