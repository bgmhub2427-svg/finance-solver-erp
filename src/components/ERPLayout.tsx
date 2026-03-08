import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCog, Database, IndianRupee,
  Receipt, FileText, ClipboardCheck, Settings, ChevronLeft,
  ChevronRight, Building2, TrendingUp, FileSpreadsheet, LogOut, Shield, User,
  CheckSquare, Lock, ScrollText, Calendar, ShieldAlert, Brain, Download, Sparkles, Search, Plus
} from 'lucide-react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { getAvailableFYs, createFinancialYear } from '@/lib/mini-supabase';
import { playClick } from '@/lib/sound-engine';
import { useToast } from '@/hooks/use-toast';

const ADMIN_NAV = [
  { to: '/control-panel', icon: LayoutDashboard, label: 'Control Panel' },
  { to: '/collection-dashboard', icon: Calendar, label: 'Collection Dashboard' },
  { to: '/handler-master', icon: UserCog, label: 'Handler Master' },
  { to: '/client-master', icon: Users, label: 'Client Master' },
  { to: '/master-database', icon: Database, label: 'Master Database' },
  { to: '/payments', icon: IndianRupee, label: 'Payment Tracking' },
  { to: '/payment-pending', icon: ClipboardCheck, label: 'Pending Checklist' },
  { to: '/invoices', icon: FileText, label: 'Invoice Manager' },
  { to: '/upload-sync', icon: Receipt, label: 'Upload Sync' },
  { to: '/approvals', icon: CheckSquare, label: 'Approvals' },
  { to: '/invoice-database', icon: FileSpreadsheet, label: 'Invoice Database' },
  { to: '/reports', icon: TrendingUp, label: 'Reports' },
  { to: '/advanced-reports', icon: TrendingUp, label: 'Advanced Analytics' },
  { to: '/risk-detection', icon: ShieldAlert, label: 'Risk Detection' },
  { to: '/ai-planner', icon: Brain, label: 'AI Collection Planner' },
  { to: '/excel-master-sync', icon: Download, label: 'Excel Master Sync' },
  { to: '/month-lock', icon: Lock, label: 'Month Lock' },
  { to: '/audit-log', icon: ScrollText, label: 'Audit Log' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const HANDLER_NAV = [
  { to: '/control-panel', icon: LayoutDashboard, label: 'My Dashboard' },
  { to: '/collection-dashboard', icon: Calendar, label: 'Collection Dashboard' },
  { to: '/client-master', icon: Users, label: 'My Clients' },
  { to: '/payments', icon: IndianRupee, label: 'Payment Tracking' },
  { to: '/payment-pending', icon: ClipboardCheck, label: 'Pending Checklist' },
  { to: '/invoices', icon: FileText, label: 'Invoice Manager' },
  { to: '/upload-sync', icon: Receipt, label: 'Upload Sync' },
  { to: '/ai-planner', icon: Brain, label: 'AI Collection Planner' },
];

const FEE_COLLECTOR_NAV = [
  { to: '/payments', icon: IndianRupee, label: 'Payment Tracking' },
  { to: '/payment-pending', icon: ClipboardCheck, label: 'Pending Checklist' },
  { to: '/upload-sync', icon: Receipt, label: 'Upload Sync' },
];

const VIEWER_NAV = [
  { to: '/master-database', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/collection-dashboard', icon: Calendar, label: 'Collection Dashboard' },
  { to: '/master-database', icon: Database, label: 'Master Database' },
  { to: '/payments', icon: IndianRupee, label: 'Payment Tracking' },
  { to: '/payment-pending', icon: ClipboardCheck, label: 'Pending Checklist' },
  { to: '/invoice-database', icon: FileSpreadsheet, label: 'Invoice Database' },
  { to: '/reports', icon: TrendingUp, label: 'Reports' },
  { to: '/advanced-reports', icon: TrendingUp, label: 'Advanced Analytics' },
];

export default function ERPLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { currentFY, setCurrentFY, refreshData } = useERP();
  const { signOut, user, isAdmin, isViewer, handlerCode } = useAuth();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');
  const [showNewFY, setShowNewFY] = useState(false);
  const [newFYInput, setNewFYInput] = useState('');
  const { toast } = useToast();
  const availableFYs = getAvailableFYs();

  const { role } = useAuth();
  const navItems = isAdmin ? ADMIN_NAV : isViewer ? VIEWER_NAV : role === 'fee_collector' ? FEE_COLLECTOR_NAV : HANDLER_NAV;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={`erp-sidebar flex flex-col transition-all duration-300 ease-out ${collapsed ? 'w-[72px]' : 'w-64'} shrink-0 relative z-20`}>
        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-sidebar-border/50">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-lg hover:shadow-xl transition-shadow">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="truncate animate-fade-in">
              <div className="text-xs font-bold tracking-wider gradient-text">FINANCE SOLVER</div>
              <div className="text-[10px] text-sidebar-foreground/40">Kota Associates V3</div>
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
              <span className="text-xs opacity-50 font-medium">Finance Solver ERP — LTSC Kota Associates V3</span>
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
                onChange={e => { setCurrentFY(e.target.value); playClick(); }}
                className="bg-transparent text-sidebar-accent-foreground text-xs font-semibold focus:outline-none cursor-pointer"
              >
                {FINANCIAL_YEARS.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>
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
