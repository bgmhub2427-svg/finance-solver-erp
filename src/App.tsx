import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import type { ReactNode } from "react";
import WelcomeLoader from "@/components/WelcomeLoader";
import LoginSummary from "@/components/LoginSummary";
import { ERPProvider } from "@/lib/erp-store";
import { useDailyReportAutoSave } from "@/hooks/useDailyReportAutoSave";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { OrgProvider, useOrg } from "@/hooks/useOrg";
import ERPLayout from "@/components/ERPLayout";
import Auth from "./pages/Auth";
import OrgSetup from "./pages/OrgSetup";
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
  if (role === "fee_collector") return "/payments";
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

function ModuleRoute({ moduleId, children, adminOnly, nonViewer, adminOrViewer }: { 
  moduleId: string; children: ReactNode; adminOnly?: boolean; nonViewer?: boolean; adminOrViewer?: boolean 
}) {
  const { enabledModules } = useOrg();
  const { isAdmin, isViewer, loading, role } = useAuth();
  
  if (loading) return null;
  if (!enabledModules.includes(moduleId)) return <Navigate to={getDefaultPath(role)} replace />;
  if (adminOnly && !isAdmin) return <Navigate to={getDefaultPath(role)} replace />;
  if (nonViewer && isViewer) return <Navigate to={getDefaultPath(role)} replace />;
  if (adminOrViewer && !isAdmin && !isViewer) return <Navigate to={getDefaultPath(role)} replace />;
  
  return <>{children}</>;
}

function DailyReportRunner() {
  useDailyReportAutoSave();
  return null;
}

function ProtectedRoutes() {
  const { user, loading, role } = useAuth();
  const { isOrgSetupDone } = useOrg();

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

  // If user has no org setup, show the setup wizard
  if (!isOrgSetupDone) {
    return <OrgSetup />;
  }

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
          <Route path="/control-panel" element={<ModuleRoute moduleId="control-panel"><ControlPanel /></ModuleRoute>} />
          <Route path="/collection-dashboard" element={<ModuleRoute moduleId="collection-dashboard"><CollectionDashboard /></ModuleRoute>} />
          <Route path="/handler-master" element={<ModuleRoute moduleId="handler-master" adminOnly><HandlerMaster /></ModuleRoute>} />
          <Route path="/client-master" element={<ModuleRoute moduleId="client-master" nonViewer><ClientMaster /></ModuleRoute>} />
          <Route path="/master-database" element={<ModuleRoute moduleId="master-database" adminOrViewer><MasterDatabase /></ModuleRoute>} />
          <Route path="/payments" element={<ModuleRoute moduleId="payments"><PaymentTracking /></ModuleRoute>} />
          <Route path="/payment-pending" element={<ModuleRoute moduleId="payment-pending"><PendingChecklist /></ModuleRoute>} />
          <Route path="/invoices" element={<ModuleRoute moduleId="invoices" nonViewer><InvoiceManager /></ModuleRoute>} />
          <Route path="/invoice-database" element={<ModuleRoute moduleId="invoice-database" adminOrViewer><InvoiceDatabase /></ModuleRoute>} />
          <Route path="/reports" element={<ModuleRoute moduleId="reports" adminOrViewer><Reports /></ModuleRoute>} />
          <Route path="/advanced-reports" element={<ModuleRoute moduleId="advanced-reports" adminOrViewer><AdvancedReports /></ModuleRoute>} />
          <Route path="/upload-sync" element={<ModuleRoute moduleId="upload-sync" nonViewer><UploadSync /></ModuleRoute>} />
          <Route path="/approvals" element={<ModuleRoute moduleId="approvals" adminOnly><Approvals /></ModuleRoute>} />
          <Route path="/month-lock" element={<ModuleRoute moduleId="month-lock" adminOnly><MonthLock /></ModuleRoute>} />
          <Route path="/audit-log" element={<ModuleRoute moduleId="audit-log" adminOnly><AuditLog /></ModuleRoute>} />
          <Route path="/risk-detection" element={<ModuleRoute moduleId="risk-detection" adminOnly><RiskDetection /></ModuleRoute>} />
          <Route path="/ai-planner" element={<ModuleRoute moduleId="ai-planner"><AIPlanner /></ModuleRoute>} />
          <Route path="/excel-master-sync" element={<ModuleRoute moduleId="excel-master-sync" adminOnly><ExcelMasterSync /></ModuleRoute>} />
          <Route path="/settings" element={<ModuleRoute moduleId="settings" adminOnly><Settings /></ModuleRoute>} />
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
  const [loaded, setLoaded] = useState(false);
  const handleLoaded = useCallback(() => setLoaded(true), []);

  if (!loaded) {
    return <WelcomeLoader onComplete={handleLoaded} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <OrgProvider>
            <HashRouter>
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="/auth" element={<AuthGate />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </HashRouter>
          </OrgProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
