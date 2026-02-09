import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
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
import Reports from "./pages/Reports";
import UsersPage from "./pages/UsersPage";
import Expenses from "./pages/Expenses";
import Performance from "./pages/Performance";
import MasterDashboard from "./pages/MasterDashboard";
import MasterTenants from "./pages/MasterTenants";
import MasterStats from "./pages/MasterStats";
import MasterBilling from "./pages/MasterBilling";
import MasterSettings from "./pages/MasterSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, masterOnly = false }: { children: React.ReactNode; masterOnly?: boolean }) => {
  const { user, loading, isMasterAdmin, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Check tenant is active for non-master users
  if (!isMasterAdmin && profile && !profile.is_master_admin) {
    // tenant checks handled elsewhere
  }

  if (masterOnly && !isMasterAdmin) return <Navigate to="/" replace />;

  return <AppLayout>{children}</AppLayout>;
};

const AppRoutes = () => {
  const { user, loading, isMasterAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to={isMasterAdmin ? '/master' : '/'} replace /> : <Auth />} />

      {/* Tenant routes */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/loads" element={<ProtectedRoute><Loads /></ProtectedRoute>} />
      <Route path="/fleet" element={<ProtectedRoute><Fleet /></ProtectedRoute>} />
      <Route path="/drivers" element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
      <Route path="/dispatchers" element={<ProtectedRoute><Dispatchers /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/companies" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
      <Route path="/tracking" element={<ProtectedRoute><Tracking /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />

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

const App = () => (
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
);

export default App;
