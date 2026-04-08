import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AuthLayout from '@/components/layout/AuthLayout';
import AppLayout from '@/components/layout/AppLayout';

// Auth pages
import LoginPage from '@/pages/LoginPage';
import SignUpPage from '@/pages/SignUpPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';

// App pages
import OnboardingPage from '@/pages/OnboardingPage';
import DashboardPage from '@/pages/DashboardPage';
import FleetPage from '@/pages/FleetPage';
import AddAircraftPage from '@/pages/AddAircraftPage';
import AircraftDetailPage from '@/pages/AircraftDetailPage';
import NewTripPage from '@/pages/NewTripPage';
import TripLegsPage from '@/pages/TripLegsPage';
import TripFuelPage from '@/pages/TripFuelPage';
import TripSummaryPage from '@/pages/TripSummaryPage';
import TripEmailPage from '@/pages/TripEmailPage';
import SavingsPage from '@/pages/SavingsPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminDashboardPage from '@/pages/AdminDashboardPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Auth routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            {/* Onboarding (no sidebar) */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />

            {/* App routes with sidebar */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/fleet" element={<FleetPage />} />
              <Route path="/fleet/add" element={<AddAircraftPage />} />
              <Route path="/fleet/:id" element={<AircraftDetailPage />} />
              <Route path="/trips/new" element={<NewTripPage />} />
              <Route path="/trips/:tripId/legs" element={<TripLegsPage />} />
              <Route path="/trips/:tripId/fuel" element={<TripFuelPage />} />
              <Route path="/trips/:tripId/summary" element={<TripSummaryPage />} />
              <Route path="/trips/:tripId/email" element={<TripEmailPage />} />
              <Route path="/savings" element={<SavingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireRole={['Admin']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
