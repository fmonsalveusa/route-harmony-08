import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { DriverMobileLayout } from "@/components/driver-app/DriverMobileLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Loads from "./pages/Loads";
import Fleet from "./pages/Fleet";
import Drivers from "./pages/Drivers";
import Dispatchers from "./pages/Dispatchers";
import Payments from "./pages/Payments";
import Invoices from "./pages/Invoices";
import Companies from "./pages/Companies";
import Tracking from "./pages/Tracking";
import DriverRouteHistory from "./pages/DriverRouteHistory";

import UsersPage from "./pages/UsersPage";
import Expenses from "./pages/Expenses";
import Performance from "./pages/Performance";
import Maintenance from "./pages/Maintenance";
import MasterDashboard from "./pages/MasterDashboard";
import MasterTenants from "./pages/MasterTenants";
import MasterStats from "./pages/MasterStats";
import MasterBilling from "./pages/MasterBilling";
import MasterSettings from "./pages/MasterSettings";
import NotFound from "./pages/NotFound";
import DriverOnboarding from "./pages/DriverOnboarding";
import Install from "./pages/Install";
import Landing from "./pages/Landing";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Brokers from "./pages/Brokers";
import Pricing from "./pages/Pricing";
import Register from "./pages/Register";

import DriverDashboard from "./pages/driver-app/DriverDashboard";
import DriverLoads from "./pages/driver-app/DriverLoads";
import DriverLoadDetail from "./pages/driver-app/DriverLoadDetail";
import DriverPayments from "./pages/driver-app/DriverPayments";
import DriverProfile from "./pages/driver-app/DriverProfile";
import DriverTracking from "./pages/driver-app/DriverTracking";
import { DriverTrackingProvider } from "./contexts/DriverTrackingContext";
import { isNativePlatform } from "./lib/nativeTracking";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground" />
    <p className="text-sm text-muted-foreground">Conectando...</p>
  </div>
);

const ProtectedRoute = ({ children, masterOnly = false }: { children: React.ReactNode; masterOnly?: boolean }) => {
  const { user, loading, isMasterAdmin, profile, role } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || !profile) return <Navigate to="/auth" replace />;

  // Drivers should always use the mobile app
  if (role === 'driver') return <Navigate to="/driver" replace />;

  // Check tenant is active for non-master users
  if (!isMasterAdmin && profile && !profile.is_master_admin) {
    // tenant checks handled elsewhere
  }

  if (masterOnly && !isMasterAdmin) return <Navigate to="/" replace />;

  return <AppLayout>{children}</AppLayout>;
};

const DriverWrapper = () => {
  const { user, loading, role, isMasterAdmin } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Non-drivers should not access the driver app
  if (role && role !== 'driver') {
    if (isMasterAdmin) return <Navigate to="/master" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DriverTrackingProvider>
      <DriverMobileLayout>
        <Outlet />
      </DriverMobileLayout>
    </DriverTrackingProvider>
  );
};

const AppRoutes = () => {
  const { user, loading, isMasterAdmin, role } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // Determine redirect path after login
  const getRedirectPath = () => {
    if (isMasterAdmin) return '/master';
    if (role === 'driver') return '/driver';
    return '/dashboard';
  };

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to={getRedirectPath()} replace /> : <Auth />} />
      <Route path="/onboarding/:token" element={<DriverOnboarding />} />
      <Route path="/install" element={<Install />} />
      <Route path="/" element={user ? <Navigate to={getRedirectPath()} replace /> : isNativePlatform() ? <Navigate to="/auth" replace /> : <Landing />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/register" element={<Register />} />

      {/* Driver mobile routes */}
      <Route path="/driver" element={<DriverWrapper />}>
        <Route index element={<DriverDashboard />} />
        <Route path="loads" element={<DriverLoads />} />
        <Route path="loads/:loadId" element={<DriverLoadDetail />} />
        <Route path="payments" element={<DriverPayments />} />
        <Route path="profile" element={<DriverProfile />} />
        <Route path="tracking" element={<DriverTracking />} />
      </Route>

      {/* Tenant routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/loads" element={<ProtectedRoute><Loads /></ProtectedRoute>} />
      <Route path="/fleet" element={<ProtectedRoute><Fleet /></ProtectedRoute>} />
      <Route path="/drivers" element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
      <Route path="/dispatchers" element={<ProtectedRoute><Dispatchers /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/companies" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
      <Route path="/tracking" element={<ProtectedRoute><Tracking /></ProtectedRoute>} />
      <Route path="/driver-route-history" element={<ProtectedRoute><Suspense fallback={<LoadingScreen />}><DriverRouteHistory /></Suspense></ProtectedRoute>} />
      
      <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
      <Route path="/maintenance" element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
      <Route path="/brokers" element={<ProtectedRoute><Brokers /></ProtectedRoute>} />

      {/* Master Admin routes */}
      <Route path="/master" element={<ProtectedRoute masterOnly><MasterDashboard /></ProtectedRoute>} />
      <Route path="/master/tenants" element={<ProtectedRoute masterOnly><MasterTenants /></ProtectedRoute>} />
      <Route path="/master/stats" element={<ProtectedRoute masterOnly><MasterStats /></ProtectedRoute>} />
      <Route path="/master/billing" element={<ProtectedRoute masterOnly><MasterBilling /></ProtectedRoute>} />
      <Route path="/master/settings" element={<ProtectedRoute masterOnly><MasterSettings /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
