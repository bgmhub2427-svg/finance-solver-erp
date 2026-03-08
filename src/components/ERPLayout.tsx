import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCog, Database, IndianRupee,
  Receipt, FileText, ClipboardCheck, Settings, ChevronLeft,
  ChevronRight, Building2, TrendingUp, FileSpreadsheet, LogOut, Shield, User,
  CheckSquare, Lock, ScrollText, Calendar, ShieldAlert, Brain, Download
} from 'lucide-react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { FINANCIAL_YEARS } from '@/lib/erp-types';

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
  const { currentFY, setCurrentFY } = useERP();
  const { signOut, user, isAdmin, isViewer, handlerCode } = useAuth();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');

  const navItems = isAdmin ? ADMIN_NAV : isViewer ? VIEWER_NAV : HANDLER_NAV;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`erp-sidebar flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'} shrink-0`}>
        {/* Logo */}
        <div className="h-12 flex items-center gap-2 px-3 border-b border-sidebar-border">
          <Building2 className="w-6 h-6 text-sidebar-primary shrink-0" />
          {!collapsed && (
            <div className="truncate">
              <div className="text-xs font-bold text-sidebar-primary tracking-wide">ENTERPRISE ERP</div>
              <div className="text-[10px] text-sidebar-foreground/50">Kota Associates LTSC V3</div>
            </div>
          )}
        </div>

        {/* Role Badge */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-sidebar-border">
            <div className="flex items-center gap-1.5">
              {isAdmin ? <Shield className="w-3 h-3 text-primary" /> : <User className="w-3 h-3 text-muted-foreground" />}
              <span
                className={`erp-role-badge text-[10px] font-semibold uppercase tracking-wider ${
                  isAdmin ? 'erp-role-badge-admin' : isViewer ? 'erp-role-badge-viewer' : 'erp-role-badge-handler'
                }`}
              >
                {isAdmin ? 'ADMIN' : isViewer ? 'VIEWER' : handlerCode || 'HANDLER'}
              </span>
            </div>
            <p className="text-[9px] text-sidebar-foreground/40 truncate mt-0.5">{user?.email}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item, idx) => (
            <NavLink
              key={`${item.to}-${idx}`}
              to={item.to}
              className={({ isActive }) =>
                `erp-sidebar-item ${isActive ? 'erp-sidebar-item-active' : ''}`
              }
              title={item.label}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="h-10 flex items-center justify-center gap-2 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-destructive transition-colors text-xs"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        {/* Collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-10 flex items-center justify-center border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="erp-header-bar justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Settings className="w-4 h-4 opacity-60" />
            <span className="text-xs opacity-60">Enterprise ERP — LTSC Kota Associates V3</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  localStorage.setItem('erp_global_search', globalSearch.trim());
                  navigate('/master-database');
                }
              }}
              placeholder="Global search: client/GST/invoice/payment"
              className="h-8 w-72 rounded-sm border border-sidebar-border bg-sidebar-accent px-2 text-xs text-sidebar-accent-foreground"
            />
            <span className="text-xs opacity-60">Financial Year:</span>
            <select
              value={currentFY}
              onChange={e => setCurrentFY(e.target.value)}
              className="bg-sidebar-accent text-sidebar-accent-foreground text-xs px-2 py-1 rounded-sm border border-sidebar-border"
            >
              {FINANCIAL_YEARS.map(fy => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-5 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
