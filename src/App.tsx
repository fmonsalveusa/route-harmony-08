import { Suspense, useState, useEffect } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { DriverMobileLayout } from "@/components/driver-app/DriverMobileLayout";
import { supabase } from "@/integrations/supabase/client";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Loads from "./pages/Loads";
import Fleet from "./pages/Fleet";
import Drivers from "./pages/Drivers";
import Investors from "./pages/Investors";
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
import Pricing from "./pages/Pricing";
import Register from "./pages/Register";
import Subscription from "./pages/Subscription";
import Documents from "./pages/Documents";
import SigningUpload from "./pages/signing/Upload";
import SigningSign from "./pages/signing/Sign";
import SigningComplete from "./pages/signing/Complete";

import DriverDashboard from "./pages/driver-app/DriverDashboard";
import DriverLoads from "./pages/driver-app/DriverLoads";
import DriverLoadDetail from "./pages/driver-app/DriverLoadDetail";
import DriverPayments from "./pages/driver-app/DriverPayments";
import DriverProfile from "./pages/driver-app/DriverProfile";
import DriverTracking from "./pages/driver-app/DriverTracking";
import { DriverTrackingProvider } from "./contexts/DriverTrackingContext";
import { isNativePlatform } from "./lib/nativeTracking";
import { UpdatePrompt } from "./components/UpdatePrompt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const withTimeout = <T,>(promise: PromiseLike<T>, fallback: T, label: string, timeoutMs = 8000) =>
  Promise.race<T>([
    Promise.resolve(promise).catch((error) => {
      console.warn(`[App] ${label} failed:`, error);
      return fallback;
    }),
    new Promise<T>((resolve) => {
      window.setTimeout(() => {
        console.warn(`[App] ${label} timed out`);
        resolve(fallback);
      }, timeoutMs);
    }),
  ]);

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-foreground" />
    <p className="text-sm text-muted-foreground">Conectando...</p>
  </div>
);

const ProtectedRoute = ({ children, masterOnly = false }: { children: React.ReactNode; masterOnly?: boolean }) => {
  const { user, loading, isMasterAdmin, profile, role } = useAuth();
  const [companyCheck, setCompanyCheck] = useState<{ loaded: boolean; hasCompany: boolean }>({ loaded: false, hasCompany: true });
  const currentPath = window.location.pathname;

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!profile?.tenant_id || profile.is_master_admin) {
        if (!cancelled) setCompanyCheck({ loaded: true, hasCompany: true });
        return;
      }

      if (!cancelled) setCompanyCheck({ loaded: false, hasCompany: true });

      const result = await withTimeout(
        supabase
          .from("companies")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id),
        { count: 1, error: new Error("company_check_timeout") } as { count: number | null; error: Error | null },
        "company check"
      );

      if (cancelled) return;

      if (result.error) {
        console.warn("[App] Company check fallback used:", result.error);
      }

      setCompanyCheck({ loaded: true, hasCompany: (result.count ?? 1) > 0 });
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, [profile?.tenant_id, profile?.is_master_admin]);

  if (loading || !companyCheck.loaded) {
    return <LoadingScreen />;
  }

  if (!user || !profile) return <Navigate to="/auth" replace />;

  // Drivers should always use the mobile app
  if (role === 'driver' || role === 'investor') return <Navigate to="/driver" replace />;

  if (masterOnly && !isMasterAdmin) return <Navigate to="/" replace />;

  // If tenant has no company and user is not on /companies, redirect to setup
  if (!companyCheck.hasCompany && !isMasterAdmin && currentPath !== '/companies') {
    return <Navigate to="/companies" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

const SuspendedScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-6">
    <div className="p-4 rounded-full bg-destructive/10">
      <svg className="h-12 w-12 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <h2 className="text-xl font-bold text-center">Cuenta suspendida</h2>
    <p className="text-muted-foreground text-center max-w-sm">
      Tu empresa necesita renovar su suscripción. Contacta a tu administrador para reactivar el acceso.
    </p>
  </div>
);

const DriverWrapper = () => {
  const { user, loading, role, isMasterAdmin, profile } = useAuth();
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkSub = async () => {
      if (!profile?.tenant_id) {
        if (!cancelled) setSubLoading(false);
        return;
      }

      const result = await withTimeout(
        supabase
          .from("tenants")
          .select("subscription_status")
          .eq("id", profile.tenant_id)
          .maybeSingle(),
        { data: null, error: new Error("subscription_check_timeout") } as {
          data: { subscription_status?: string } | null;
          error: Error | null;
        },
        "subscription check"
      );

      if (cancelled) return;

      if (result.error) {
        console.warn("[App] Subscription check fallback used:", result.error);
      }

      setSubStatus(result.data?.subscription_status || null);
      setSubLoading(false);
    };

    void checkSub();

    return () => {
      cancelled = true;
    };
  }, [profile?.tenant_id]);

  if (loading || subLoading) {
    return <LoadingScreen />;
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Block suspended/canceled tenants
  if (subStatus === 'suspended' || subStatus === 'canceled') {
    return <SuspendedScreen />;
  }

  // Non-drivers/investors should not access the driver app
  if (role && role !== 'driver' && role !== 'investor') {
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
    if (role === 'investor') return '/driver/payments';
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
      <Route path="/investors" element={<ProtectedRoute><Investors /></ProtectedRoute>} />
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
      <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/documents/upload" element={<ProtectedRoute><SigningUpload /></ProtectedRoute>} />
      <Route path="/documents/sign/:id" element={<SigningSign />} />
      <Route path="/sign/:id" element={<SigningSign />} />
      <Route path="/documents/complete/:id" element={<SigningComplete />} />

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
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <UpdatePrompt />
            <Toaster />
            <Sonner />
            <AuthProvider>
              <BrowserRouter>
                <ErrorBoundary>
                  <AppRoutes />
                </ErrorBoundary>
              </BrowserRouter>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
