import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SplashScreen } from "@/components/SplashScreen";
import Onboarding from "./pages/Onboarding";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import DriverDashboard from "./pages/driver/DriverDashboard";
import DriverOnboarding from "./pages/driver/DriverOnboarding";
import Orders from "./pages/admin/Orders";
import AdminTracking from "./pages/admin/AdminTracking";
import TrackingList from "./pages/admin/TrackingList";
import Drivers from "./pages/admin/Drivers";
import MyOrders from "./pages/driver/MyOrders";
import TrackShipment from "./pages/TrackShipment";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function DashboardRedirect() {
  const { role, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Check if driver needs onboarding
  if (role === 'driver' && profile?.onboarding_status !== 'completed') {
    return <Navigate to="/driver-onboarding" replace />;
  }

  if (role === 'pharmacy_admin') {
    return <AdminDashboard />;
  }

  return <DriverDashboard />;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  const onboardingComplete = localStorage.getItem('tscp-onboarding-complete') === 'true';

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Show loading state after splash while auth is still loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public tracking routes */}
      <Route path="/track/:trackingId" element={<TrackShipment />} />
      <Route path="/TrackShipment" element={<TrackShipment />} />

      {/* Auth routes */}
      <Route
        path="/onboarding"
        element={
          user ? <Navigate to="/dashboard" replace /> : <Onboarding />
        }
      />
      <Route
        path="/auth"
        element={
          user ? <Navigate to="/dashboard" replace /> : <Auth />
        }
      />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          !user ? (
            onboardingComplete ? <Navigate to="/auth" replace /> : <Navigate to="/onboarding" replace />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
      
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardRedirect />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin/tracking/:orderId"
        element={
          <ProtectedRoute allowedRoles={['pharmacy_admin']}>
            <AdminTracking />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute allowedRoles={['pharmacy_admin']}>
            <Orders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/drivers"
        element={
          <ProtectedRoute allowedRoles={['pharmacy_admin']}>
            <Drivers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/track"
        element={
          <ProtectedRoute allowedRoles={['pharmacy_admin']}>
            <TrackingList />
          </ProtectedRoute>
        }
      />

      {/* Driver routes */}
      <Route
        path="/driver-onboarding"
        element={
          <ProtectedRoute allowedRoles={['driver']}>
            <DriverOnboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-orders"
        element={
          <ProtectedRoute allowedRoles={['driver']}>
            <MyOrders />
          </ProtectedRoute>
        }
      />

      {/* Shared routes */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
