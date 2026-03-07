import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import type { ReactNode } from "react";
import { ERPProvider } from "@/lib/erp-store";
import { useDailyReportAutoSave } from "@/hooks/useDailyReportAutoSave";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ERPLayout from "@/components/ERPLayout";
import Auth from "./pages/Auth";
import ControlPanel from "./pages/ControlPanel";
import HandlerMaster from "./pages/HandlerMaster";
import ClientMaster from "./pages/ClientMaster";
import MasterDatabase from "./pages/MasterDatabase";
import PaymentTracking from "./pages/PaymentTracking";
import PendingChecklist from "./pages/PendingChecklist";
import InvoiceManager from "./pages/InvoiceManager";
import InvoiceDatabase from "./pages/InvoiceDatabase";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import UploadSync from "./pages/UploadSync";
import Approvals from "./pages/Approvals";
import MonthLock from "./pages/MonthLock";
import AuditLog from "./pages/AuditLog";
import CollectionDashboard from "./pages/CollectionDashboard";
import RiskDetection from "./pages/RiskDetection";
import AIPlanner from "./pages/AIPlanner";
import ExcelMasterSync from "./pages/ExcelMasterSync";
import AdvancedReports from "./pages/AdvancedReports";
import NotFound from "./pages/NotFound";
import { miniAuth } from "@/lib/mini-supabase";

const queryClient = new QueryClient();

function getDefaultPath(role: ReturnType<typeof useAuth>["role"]) {
  if (role === "admin" || role === "manager") return "/control-panel";
  if (role === "viewer") return "/master-database";
  if (role === "handler") return "/control-panel";
  return "/auth";
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, loading, role } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to={getDefaultPath(role)} replace />;
  return <>{children}</>;
}

function AdminOrViewerRoute({ children }: { children: ReactNode }) {
  const { isAdmin, isViewer, loading, role } = useAuth();
  if (loading) return null;
  if (!isAdmin && !isViewer) return <Navigate to={getDefaultPath(role)} replace />;
  return <>{children}</>;
}

function NonViewerRoute({ children }: { children: ReactNode }) {
  const { isViewer, loading, role } = useAuth();
  if (loading) return null;
  if (isViewer) return <Navigate to={getDefaultPath(role)} replace />;
  return <>{children}</>;
}

function DailyReportRunner() {
  useDailyReportAutoSave();
  return null;
}

function ProtectedRoutes() {
  const { user, loading, role } = useAuth();

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading ERP System...</p>
        </div>
      </div>
    );

  if (!user) return <Navigate to="/auth" replace />;

  if (!role)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );

  if (role === "none")
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 p-8">
          <p className="text-lg font-semibold">Access Denied</p>
          <p className="text-sm text-muted-foreground">Your account has no assigned role. Contact the admin.</p>
          <button
            onClick={() => { miniAuth.signOut(); }}
            className="text-sm text-primary hover:underline"
          >
            Sign Out
          </button>
        </div>
      </div>
    );

  return (
    <ERPProvider>
      <DailyReportRunner />
      <Routes>
        <Route path="/" element={<Navigate to={getDefaultPath(role)} replace />} />
        <Route element={<ERPLayout />}>
          <Route path="/control-panel" element={<ControlPanel />} />
          <Route path="/collection-dashboard" element={<CollectionDashboard />} />
          <Route path="/handler-master" element={<AdminRoute><HandlerMaster /></AdminRoute>} />
          <Route path="/client-master" element={<NonViewerRoute><ClientMaster /></NonViewerRoute>} />
          <Route path="/master-database" element={<AdminOrViewerRoute><MasterDatabase /></AdminOrViewerRoute>} />
          <Route path="/payments" element={<PaymentTracking />} />
          <Route path="/payment-pending" element={<PendingChecklist />} />
          <Route path="/invoices" element={<NonViewerRoute><InvoiceManager /></NonViewerRoute>} />
          <Route path="/invoice-database" element={<AdminOrViewerRoute><InvoiceDatabase /></AdminOrViewerRoute>} />
          <Route path="/reports" element={<AdminOrViewerRoute><Reports /></AdminOrViewerRoute>} />
          <Route path="/advanced-reports" element={<AdminOrViewerRoute><AdvancedReports /></AdminOrViewerRoute>} />
          <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
          <Route path="/upload-sync" element={<NonViewerRoute><UploadSync /></NonViewerRoute>} />
          <Route path="/approvals" element={<AdminRoute><Approvals /></AdminRoute>} />
          <Route path="/month-lock" element={<AdminRoute><MonthLock /></AdminRoute>} />
          <Route path="/audit-log" element={<AdminRoute><AuditLog /></AdminRoute>} />
          <Route path="/risk-detection" element={<AdminRoute><RiskDetection /></AdminRoute>} />
          <Route path="/ai-planner" element={<AIPlanner />} />
          <Route path="/excel-master-sync" element={<AdminRoute><ExcelMasterSync /></AdminRoute>} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ERPProvider>
  );
}

function AuthGate() {
  const { user, loading, role } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={getDefaultPath(role)} replace />;
  return <Auth />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <HashRouter>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/auth" element={<AuthGate />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </HashRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}


export default App;
