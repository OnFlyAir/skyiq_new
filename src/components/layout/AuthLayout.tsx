import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-skyiq-light-blue/30 px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-skyiq-blue">skyIQ</h1>
        <p className="text-gray-600 mt-1">Fly Smarter</p>
      </div>

      {/* Auth card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <Outlet />
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>
          For account support: <a href="mailto:info@skyiq.net" className="text-skyiq-accent hover:underline">info@skyiq.net</a>
        </p>
      </footer>
    </div>
  );
}
