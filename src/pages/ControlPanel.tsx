import React from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { Eye, Users, IndianRupee, AlertTriangle, TrendingUp, FileText, ClipboardList } from 'lucide-react';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function ControlPanel() {
  const { getDashboardStats, getHandlerDashboardStats, currentFY } = useERP();
  const { isAdmin, isViewer, handlerCode } = useAuth();

  if (isViewer) {
    const stats = getDashboardStats();
    const kpis = [
      { label: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-[hsl(var(--erp-kpi-blue))]', bg: 'bg-[hsl(var(--erp-kpi-blue)/0.08)]' },
      { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-[hsl(var(--erp-kpi-green))]', bg: 'bg-[hsl(var(--erp-kpi-green)/0.08)]' },
      { label: 'Collected', value: formatCurrency(stats.totalCollected), icon: IndianRupee, color: 'text-[hsl(var(--erp-kpi-blue))]', bg: 'bg-[hsl(var(--erp-kpi-blue)/0.08)]' },
      { label: 'Pending', value: formatCurrency(stats.totalPending), icon: AlertTriangle, color: 'text-[hsl(var(--erp-kpi-red))]', bg: 'bg-[hsl(var(--erp-kpi-red)/0.08)]' },
    ];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="erp-page-title">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} — Read-Only View</p>
          </div>
          <span className="erp-badge text-xs flex items-center gap-1"><Eye className="w-3 h-3" /> VIEWER</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="erp-kpi-card flex items-start gap-3">
              <div className={`${k.bg} p-2 rounded-sm`}><k.icon className={`w-5 h-5 ${k.color}`} /></div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-lg font-bold erp-mono">{k.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    const stats = getHandlerDashboardStats();
    const kpis = [
      { label: 'Assigned Clients', value: stats.assignedClients, icon: Users, color: 'text-[hsl(var(--erp-kpi-blue))]', bg: 'bg-[hsl(var(--erp-kpi-blue)/0.08)]' },
      { label: 'Payments Handled', value: stats.totalPaymentsHandled, icon: IndianRupee, color: 'text-[hsl(var(--erp-kpi-green))]', bg: 'bg-[hsl(var(--erp-kpi-green)/0.08)]' },
      { label: 'Pending Checklist', value: stats.pendingChecklistCount, icon: ClipboardList, color: 'text-[hsl(var(--erp-kpi-red))]', bg: 'bg-[hsl(var(--erp-kpi-red)/0.08)]' },
    ];

    return (
      <div className="space-y-6">
        <div>
          <h1 className="erp-page-title">My Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} — Handler: {handlerCode || 'N/A'}</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="erp-kpi-card flex items-start gap-3">
              <div className={`${k.bg} p-2 rounded-sm`}>
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-lg font-bold erp-mono">{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="erp-kpi-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h2 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Recent Invoices</h2>
          </div>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Client</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentInvoices.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-sm">No recent invoices.</td></tr>
              )}
              {stats.recentInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="erp-mono text-xs">{invoice.invoiceNo}</td>
                  <td className="erp-mono text-xs">{invoice.date}</td>
                  <td className="text-xs">{invoice.clientName}</td>
                  <td className="erp-mono text-xs text-right">{formatCurrency(invoice.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const stats = getDashboardStats();
  const collectionRate = stats.totalRevenue > 0 ? ((stats.totalCollected / stats.totalRevenue) * 100).toFixed(1) : '0';

  const kpis = [
    { label: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-[hsl(var(--erp-kpi-blue))]', bg: 'bg-[hsl(var(--erp-kpi-blue)/0.08)]' },
    { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-[hsl(var(--erp-kpi-green))]', bg: 'bg-[hsl(var(--erp-kpi-green)/0.08)]' },
    { label: 'Collected', value: formatCurrency(stats.totalCollected), icon: IndianRupee, color: 'text-[hsl(var(--erp-kpi-blue))]', bg: 'bg-[hsl(var(--erp-kpi-blue)/0.08)]' },
    { label: 'Pending', value: formatCurrency(stats.totalPending), icon: AlertTriangle, color: 'text-[hsl(var(--erp-kpi-red))]', bg: 'bg-[hsl(var(--erp-kpi-red)/0.08)]' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title">Control Panel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} — Enterprise Overview</p>
        </div>
        <span className="erp-badge erp-badge-info erp-mono text-xs">MASTER CONTROL</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="erp-kpi-card flex items-start gap-3">
            <div className={`${k.bg} p-2 rounded-sm`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-lg font-bold erp-mono">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="erp-kpi-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Collection Rate</span>
          <span className="erp-mono text-sm font-bold">{collectionRate}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-[hsl(var(--erp-kpi-green))] rounded-full transition-all" style={{ width: `${collectionRate}%` }} />
        </div>
      </div>


      <div className="grid grid-cols-3 gap-4">
        <div className="erp-kpi-card"><p className="text-xs text-muted-foreground">Invoices (FY)</p><p className="erp-mono text-lg font-bold">{(stats as any).invoiceCount || 0}</p></div>
        <div className="erp-kpi-card"><p className="text-xs text-muted-foreground">Payment Trends</p><p className="erp-mono text-lg font-bold">{(stats as any).paymentTrends || 0}</p></div>
        <div className="erp-kpi-card"><p className="text-xs text-muted-foreground">Monthly Revenue Points</p><p className="erp-mono text-lg font-bold">{((stats as any).monthlyRevenue || []).length}</p></div>
      </div>

      <div className="erp-kpi-card">
        <h3 className="text-sm font-semibold mb-2">Monthly Revenue</h3>
        <div className="space-y-2">
          {((stats as any).monthlyRevenue || []).slice(-6).map((m: any) => (
            <div key={m.month} className="flex items-center gap-2 text-xs">
              <span className="w-20 erp-mono">{m.month}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-[hsl(var(--erp-kpi-blue))]" style={{ width: `${Math.min(100, (m.amount / Math.max(1, stats.totalCollected)) * 100)}%` }} /></div>
              <span className="erp-mono">{formatCurrency(m.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="erp-kpi-card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/50">
          <h2 className="text-sm font-semibold">Handler Performance</h2>
        </div>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Handler Name</th>
              <th>Clients</th>
              <th className="text-right">Collected</th>
              <th className="text-right">Pending</th>
              <th>Completion Rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {stats.handlerPerformance.map(h => (
              <tr key={h.code}>
                <td className="erp-mono text-xs">{h.code}</td>
                <td className="font-medium text-xs">{h.name}</td>
                <td className="erp-mono">{h.clients}</td>
                <td className="erp-mono text-right">{formatCurrency(h.collected)}</td>
                <td className="erp-mono text-right">{formatCurrency(h.pending)}</td>
                <td className="erp-mono text-xs">{h.completionRate}</td>
                <td>
                  {h.pending === 0 && h.clients > 0 ? (
                    <span className="erp-badge erp-badge-success">CLEAR</span>
                  ) : h.pending > 0 ? (
                    <span className="erp-badge erp-badge-warning">PENDING</span>
                  ) : (
                    <span className="erp-badge text-muted-foreground bg-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
