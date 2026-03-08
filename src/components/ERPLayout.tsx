import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCog, Database, IndianRupee,
  Receipt, FileText, ClipboardCheck, Settings, ChevronLeft,
  ChevronRight, TrendingUp, FileSpreadsheet, LogOut, Shield, User,
  CheckSquare, Lock, ScrollText, Calendar, ShieldAlert, Brain, Download, Sparkles, Search, Plus, Building2
} from 'lucide-react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import { getAvailableFYs, createFinancialYear } from '@/lib/mini-supabase';
import { playClick } from '@/lib/sound-engine';
import { useToast } from '@/hooks/use-toast';
import { startAutoBackup } from '@/lib/auto-backup';
import { ALL_MODULES, type ModuleDef } from '@/lib/org-types';
import kaLogo from '@/assets/kota-associates-logo.png';

// Icon mapping
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Users, UserCog, Database, IndianRupee,
  Receipt, FileText, ClipboardCheck, Settings, TrendingUp,
  FileSpreadsheet, CheckSquare, Lock, ScrollText, Calendar,
  ShieldAlert, Brain, Download,
};

export default function ERPLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { currentFY, setCurrentFY, refreshData } = useERP();
  const { signOut, user, isAdmin, isViewer, handlerCode, role } = useAuth();
  const { org, enabledModules } = useOrg();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');
  const [showNewFY, setShowNewFY] = useState(false);
  const [newFYInput, setNewFYInput] = useState('');
  const { toast } = useToast();
  const availableFYs = getAvailableFYs();

  useEffect(() => { startAutoBackup(); }, []);

  // Build dynamic nav from enabled modules
  const navItems = ALL_MODULES
    .filter(m => enabledModules.includes(m.id))
    .filter(m => {
      // Role-based filtering
      if (m.adminOnly && !isAdmin) return false;
      if (m.nonViewer && isViewer) return false;
      if (m.adminOrViewer && !isAdmin && !isViewer) return false;
      // Fee collector only sees specific modules
      if (role === 'fee_collector') {
        return ['payments', 'payment-pending', 'upload-sync'].includes(m.id);
      }
      // Handler sees subset
      if (role === 'handler') {
        return !['handler-master', 'master-database', 'invoice-database', 'approvals',
          'month-lock', 'audit-log', 'risk-detection', 'excel-master-sync', 'settings',
          'reports', 'advanced-reports'].includes(m.id);
      }
      return true;
    })
    .map(m => ({
      to: m.path,
      icon: ICON_MAP[m.icon] || LayoutDashboard,
      label: m.label,
    }));

  const orgName = org?.name || 'Finance Solver';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={`erp-sidebar flex flex-col transition-all duration-300 ease-out ${collapsed ? 'w-[72px]' : 'w-64'} shrink-0 relative z-20`}>
        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-sidebar-border/50">
          <div className="w-9 h-9 rounded-xl shrink-0 shadow-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="truncate animate-fade-in">
              <div className="text-xs font-bold tracking-wider gradient-text truncate">{orgName.toUpperCase()}</div>
              <div className="text-[10px] text-sidebar-foreground/40">Finance Solver ERP</div>
            </div>
          )}
        </div>

        {/* Role Badge */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-sidebar-border/50 animate-fade-in">
            <div className="flex items-center gap-2">
              {isAdmin ? <Shield className="w-3.5 h-3.5 text-primary" /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
              <span
                className={`erp-role-badge text-[10px] font-bold uppercase tracking-widest ${
                  isAdmin ? 'erp-role-badge-admin' : isViewer ? 'erp-role-badge-viewer' : 'erp-role-badge-handler'
                }`}
              >
                {isAdmin ? 'ADMIN' : isViewer ? 'VIEWER' : role === 'fee_collector' ? 'COLLECTOR' : handlerCode || 'HANDLER'}
              </span>
            </div>
            <p className="text-[9px] text-sidebar-foreground/30 truncate mt-1 font-mono">{user?.email}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto stagger-children">
          {navItems.map((item, idx) => (
            <NavLink
              key={`${item.to}-${idx}`}
              to={item.to}
              onClick={() => playClick()}
              className={({ isActive }) =>
                `erp-sidebar-item ${isActive ? 'erp-sidebar-item-active' : ''}`
              }
              title={item.label}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate text-[13px]">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="h-11 flex items-center justify-center gap-2 border-t border-sidebar-border/50 text-sidebar-foreground/40 hover:text-destructive transition-all text-xs hover:bg-destructive/5"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="font-medium">Sign Out</span>}
        </button>

        {/* Collapse */}
        <button
          onClick={() => { setCollapsed(!collapsed); playClick(); }}
          className="h-11 flex items-center justify-center border-t border-sidebar-border/50 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-all hover:bg-sidebar-accent/50"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="erp-header-bar justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary opacity-60" />
              <span className="text-xs opacity-50 font-medium">{orgName} — Finance Solver ERP</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sidebar-foreground/30" />
              <input
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    localStorage.setItem('erp_global_search', globalSearch.trim());
                    navigate('/master-database');
                  }
                }}
                placeholder="Search clients, GST, invoices..."
                className="h-9 w-72 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/80 pl-9 pr-3 text-xs text-sidebar-accent-foreground placeholder:text-sidebar-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 bg-sidebar-accent/60 rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-sidebar-foreground/40 font-medium">FY</span>
              <select
                value={currentFY}
                onChange={e => { setCurrentFY(e.target.value); playClick(); refreshData(); }}
                className="bg-transparent text-sidebar-accent-foreground text-xs font-semibold focus:outline-none cursor-pointer"
              >
                {availableFYs.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
              {isAdmin && (
                <button
                  onClick={() => setShowNewFY(!showNewFY)}
                  className="ml-1 p-0.5 rounded hover:bg-primary/20 transition-colors"
                  title="Create New Financial Year"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" />
                </button>
              )}
            </div>
            {showNewFY && isAdmin && (
              <div className="flex items-center gap-2 bg-sidebar-accent/60 rounded-lg px-3 py-1.5">
                <input
                  value={newFYInput}
                  onChange={e => setNewFYInput(e.target.value)}
                  placeholder="e.g. 2027-2028"
                  className="h-7 w-28 rounded border border-sidebar-border/60 bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <button
                  onClick={async () => {
                    if (!newFYInput.match(/^\d{4}-\d{4}$/)) {
                      toast({ title: 'Invalid format', description: 'Use YYYY-YYYY format (e.g. 2027-2028)', variant: 'destructive' });
                      return;
                    }
                    try {
                      await createFinancialYear(newFYInput, true);
                      toast({ title: `FY ${newFYInput} created`, description: 'Clients carried forward with pending balances.' });
                      setCurrentFY(newFYInput);
                      await refreshData();
                      setShowNewFY(false);
                      setNewFYInput('');
                      playClick();
                    } catch (err: any) {
                      toast({ title: 'Error', description: err.message, variant: 'destructive' });
                    }
                  }}
                  className="h-7 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  Create
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 bg-background dot-grid">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
