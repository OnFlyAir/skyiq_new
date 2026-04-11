// App.tsx — Complete routing configuration for SkyIQ Lovable app.
// Drop this into the Lovable project to replace the existing App.tsx.
// All routes, layouts, and auth guards are configured here.

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuthContext";
import { Toaster } from "@/components/ui/toaster";

// Layouts
import AppLayout from "@/components/layout/AppLayout";
import AuthLayout from "@/components/layout/AuthLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// Auth pages
import LoginPage from "@/pages/LoginPage";
import SignUpPage from "@/pages/SignUpPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";

// App pages
import DashboardPage from "@/pages/DashboardPage";
import FleetPage from "@/pages/FleetPage";
import AddAircraftPage from "@/pages/AddAircraftPage";
import AircraftDetailPage from "@/pages/AircraftDetailPage";
import AircraftEditPage from "@/pages/AircraftEditPage";
import NewTripPage from "@/pages/NewTripPage";
import TripLegsPage from "@/pages/TripLegsPage";
import TripFuelPage from "@/pages/TripFuelPage";
import TripSummaryPage from "@/pages/TripSummaryPage";
import TripEmailPage from "@/pages/TripEmailPage";
import SavingsPage from "@/pages/SavingsPage";
import ProfilePage from "@/pages/ProfilePage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import AdminSubscriptionsPage from "@/pages/AdminSubscriptionsPage";
import SubscriptionPage from "@/pages/SubscriptionPage";
import OnboardingPage from "@/pages/OnboardingPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Auth routes — no sidebar, centered card layout */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            {/* Onboarding — protected, no sidebar */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />

            {/* Main app routes — sidebar layout, all protected */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Fleet */}
              <Route path="/fleet" element={<FleetPage />} />
              <Route path="/fleet/add" element={<AddAircraftPage />} />
              <Route path="/fleet/:id" element={<AircraftDetailPage />} />
              <Route path="/fleet/:id/edit" element={<AircraftEditPage />} />

              {/* Trip workflow */}
              <Route path="/trips/new" element={<NewTripPage />} />
              <Route path="/trips/:tripId/legs" element={<TripLegsPage />} />
              <Route path="/trips/:tripId/fuel" element={<TripFuelPage />} />
              <Route path="/trips/:tripId/summary" element={<TripSummaryPage />} />
              <Route path="/trips/:tripId/email" element={<TripEmailPage />} />

              {/* Other */}
              <Route path="/savings" element={<SavingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              <Route path="/subscription" element={<SubscriptionPage />} />

              {/* Admin — role-gated inside the component */}
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
