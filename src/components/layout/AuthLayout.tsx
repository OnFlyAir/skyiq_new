import { Outlet } from 'react-router-dom';
import skyiqLogoDark from '@/assets/skyiq-logo-dark.png';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 relative overflow-hidden">
      {/* Decorative background shapes */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-200/30 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-200/30 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />

      {/* Logo */}
      <div className="mb-10 flex flex-col items-center relative z-10">
        <img src={skyiqLogoDark} alt="SkyIQ" className="w-24 h-24 object-contain drop-shadow-md" />
      </div>

      {/* Auth card */}
      <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 p-10 relative z-10">
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
