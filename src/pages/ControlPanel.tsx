import React, { useMemo } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { Eye, Users, IndianRupee, AlertTriangle, TrendingUp, FileText, ClipboardList, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function ControlPanel() {
  const { getDashboardStats, getHandlerDashboardStats, currentFY, clients, payments, invoices } = useERP();
  const { isAdmin, isViewer, handlerCode } = useAuth();
  const navigate = useNavigate();

  const stats = getDashboardStats();

  // Top 5 overdue (hoisted before early returns to satisfy hooks rules)
  const topOverdue = useMemo(() => {
    const fyClients = clients.filter(c => c.financialYear === currentFY);
    const fyPayments = payments.filter(p => p.financialYear === currentFY);
    const fyInvoices = invoices.filter(i => i.financialYear === currentFY);

    const clientPending: { clientId: string; name: string; handler: string; pending: number; days: number }[] = [];

    fyInvoices.forEach(inv => {
      const received = fyPayments.filter(p => p.clientId === inv.clientId).reduce((s, p) => s + p.payment, 0);
      const pending = Math.max(0, inv.total - Math.min(received, inv.total));
      if (pending > 0) {
        const days = Math.floor((Date.now() - new Date(inv.date).getTime()) / 86400000);
        if (days > 30) {
          const existing = clientPending.find(c => c.clientId === inv.clientId);
          if (existing) { existing.pending += pending; existing.days = Math.max(existing.days, days); }
          else clientPending.push({ clientId: inv.clientId, name: inv.clientName, handler: inv.handlerCode, pending, days });
        }
      }
    });

    fyClients.forEach(c => {
      if (!fyInvoices.some(i => i.clientId === c.clientId) && c.totalPending > 0) {
        const days = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000);
        if (days > 30) {
          const existing = clientPending.find(x => x.clientId === c.clientId);
          if (!existing) clientPending.push({ clientId: c.clientId, name: c.name, handler: c.handlerCode, pending: c.totalPending, days });
        }
      }
    });

    return clientPending.sort((a, b) => b.pending - a.pending).slice(0, 5);
  }, [clients, payments, invoices, currentFY]);

  if (isViewer) {
    const stats = getDashboardStats();
    const kpis = [
      { label: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-info', bg: 'bg-info/10' },
      { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
      { label: 'Collected', value: formatCurrency(stats.totalCollected), icon: IndianRupee, color: 'text-info', bg: 'bg-info/10' },
      { label: 'Pending', value: formatCurrency(stats.totalPending), icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
    ];
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="erp-page-title">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} — Read-Only View</p>
          </div>
          <span className="erp-badge erp-badge-info text-xs flex items-center gap-1"><Eye className="w-3 h-3" /> VIEWER</span>
        </div>
        <div className="grid grid-cols-4 gap-4 perspective-container stagger-children">
          {kpis.map(k => (
            <div key={k.label} className="erp-kpi-card card-3d flex items-start gap-3">
              <div className={`kpi-icon-box ${k.bg}`}><k.icon className={`w-5 h-5 ${k.color}`} /></div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="kpi-value erp-mono">{k.value}</p>
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
      { label: 'Assigned Clients', value: stats.assignedClients, icon: Users, color: 'text-info', bg: 'bg-info/10' },
      { label: 'Payments Handled', value: stats.totalPaymentsHandled, icon: IndianRupee, color: 'text-success', bg: 'bg-success/10' },
      { label: 'Pending Checklist', value: stats.pendingChecklistCount, icon: ClipboardList, color: 'text-destructive', bg: 'bg-destructive/10' },
    ];

    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="erp-page-title">My Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} — Handler: {handlerCode || 'N/A'}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 perspective-container stagger-children">
          {kpis.map(k => (
            <div key={k.label} className="erp-kpi-card card-3d flex items-start gap-3">
              <div className={`kpi-icon-box ${k.bg}`}>
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="kpi-value erp-mono">{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="erp-kpi-card p-0 overflow-hidden animate-card-enter" style={{ animationDelay: '200ms' }}>
          <div className="px-5 py-3.5 border-b bg-muted/30">
            <h2 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Recent Invoices</h2>
          </div>
          <table className="erp-table">
            <thead><tr><th>Invoice No</th><th>Date</th><th>Client</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {stats.recentInvoices.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No recent invoices.</td></tr>
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

  const collectionRate = stats.totalRevenue > 0 ? ((stats.totalCollected / stats.totalRevenue) * 100).toFixed(1) : '0';

  const kpis = [
    { label: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-info', bg: 'bg-info/10', trend: null },
    { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-success', bg: 'bg-success/10', trend: 'up' },
    { label: 'Collected', value: formatCurrency(stats.totalCollected), icon: IndianRupee, color: 'text-info', bg: 'bg-info/10', trend: 'up' },
    { label: 'Pending', value: formatCurrency(stats.totalPending), icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', trend: stats.totalPending > 0 ? 'down' : null },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Control Panel
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} — Enterprise Overview</p>
        </div>
        <span className="erp-badge erp-badge-info erp-mono text-xs font-bold">MASTER CONTROL</span>
      </div>

      {/* KPI Grid with 3D Cards */}
      <div className="grid grid-cols-4 gap-4 perspective-container stagger-children">
        {kpis.map((k, i) => (
          <div key={k.label} className="erp-kpi-card card-3d flex items-start gap-3 group">
            <div className={`kpi-icon-box ${k.bg}`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground font-medium">{k.label}</p>
                {k.trend === 'up' && <ArrowUpRight className="w-3.5 h-3.5 text-success opacity-0 group-hover:opacity-100 transition-opacity" />}
                {k.trend === 'down' && <ArrowDownRight className="w-3.5 h-3.5 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" />}
              </div>
              <p className="kpi-value erp-mono">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Collection Rate with Glow */}
      <div className="erp-kpi-card animate-card-enter" style={{ animationDelay: '250ms' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">Collection Rate</span>
          <span className="erp-mono text-lg font-bold gradient-text">{collectionRate}%</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent animate-progress progress-glow"
            style={{ width: `${collectionRate}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 stagger-children">
        <div className="erp-kpi-card card-3d text-center">
          <p className="text-[11px] text-muted-foreground font-medium">Invoices (FY)</p>
          <p className="kpi-value erp-mono">{(stats as any).invoiceCount || 0}</p>
        </div>
        <div className="erp-kpi-card card-3d text-center">
          <p className="text-[11px] text-muted-foreground font-medium">Payment Trends</p>
          <p className="kpi-value erp-mono">{(stats as any).paymentTrends || 0}</p>
        </div>
        <div className="erp-kpi-card card-3d text-center">
          <p className="text-[11px] text-muted-foreground font-medium">Monthly Revenue Points</p>
          <p className="kpi-value erp-mono">{((stats as any).monthlyRevenue || []).length}</p>
        </div>
      </div>

      {/* Monthly Revenue */}
      <div className="erp-kpi-card animate-card-enter" style={{ animationDelay: '350ms' }}>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Monthly Revenue
        </h3>
        <div className="space-y-2.5">
          {((stats as any).monthlyRevenue || []).slice(-6).map((m: any) => (
            <div key={m.month} className="flex items-center gap-3 text-xs group">
              <span className="w-20 erp-mono text-muted-foreground">{m.month}</span>
              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full animate-progress"
                  style={{ width: `${Math.min(100, (m.amount / Math.max(1, stats.totalCollected)) * 100)}%` }}
                />
              </div>
              <span className="erp-mono font-semibold w-24 text-right group-hover:text-primary transition-colors">{formatCurrency(m.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top 5 Overdue — Pending Dashboard Widget */}
      {topOverdue.length > 0 && (
        <div className="erp-kpi-card p-0 overflow-hidden animate-card-enter" style={{ animationDelay: '375ms' }}>
          <div className="px-5 py-3.5 border-b bg-destructive/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Top 5 Overdue Clients
            </h2>
            <button onClick={() => navigate('/pending-dashboard')} className="text-[10px] text-primary hover:underline font-medium">
              View All →
            </button>
          </div>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Handler</th>
                <th className="text-right">Overdue Amount</th>
                <th className="text-right">Days</th>
              </tr>
            </thead>
            <tbody>
              {topOverdue.map(c => (
                <tr key={c.clientId}>
                  <td>
                    <div className="text-xs font-medium">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground erp-mono">{c.clientId}</div>
                  </td>
                  <td className="erp-mono text-xs">{c.handler}</td>
                  <td className="erp-mono text-xs text-right font-bold text-destructive">{formatCurrency(c.pending)}</td>
                  <td className="erp-mono text-xs text-right">
                    <span className={c.days > 90 ? 'text-destructive font-bold' : c.days > 60 ? 'text-warning' : ''}>{c.days}d</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Handler Performance */}
      <div className="erp-kpi-card p-0 overflow-hidden animate-card-enter" style={{ animationDelay: '400ms' }}>
        <div className="px-5 py-3.5 border-b bg-muted/30">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Handler Performance
          </h2>
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
                <td className="erp-mono text-xs font-semibold">{h.code}</td>
                <td className="font-medium text-xs">{h.name}</td>
                <td className="erp-mono">{h.clients}</td>
                <td className="erp-mono text-right font-semibold text-success">{formatCurrency(h.collected)}</td>
                <td className="erp-mono text-right">{formatCurrency(h.pending)}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: h.completionRate }} />
                    </div>
                    <span className="erp-mono text-xs">{h.completionRate}</span>
                  </div>
                </td>
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
