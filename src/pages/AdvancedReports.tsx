import React, { useMemo, useState } from 'react';
import { useERP } from '@/lib/erp-store';
import { MONTHS } from '@/lib/erp-types';
import { TrendingUp, Users, IndianRupee, FileText, CheckCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

const COLORS = ['#0891b2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#e11d48'];

type ReportTab = 'overview' | 'collections' | 'handlers' | 'invoices' | 'aging' | 'approvals';

export default function AdvancedReports() {
  const { clients, payments, invoices, handlers, currentFY } = useERP();
  const [tab, setTab] = useState<ReportTab>('overview');

  const fyClients = useMemo(() => clients.filter(c => c.financialYear === currentFY), [clients, currentFY]);
  const fyPayments = useMemo(() => payments.filter(p => p.financialYear === currentFY), [payments, currentFY]);
  const fyInvoices = useMemo(() => invoices.filter(i => i.financialYear === currentFY), [invoices, currentFY]);

  const totalRevenue = fyClients.reduce((s, c) => s + c.oldFeeDue + c.newFeeDue, 0);
  const totalCollected = fyPayments.reduce((s, p) => s + p.payment, 0);
  const totalPending = fyClients.reduce((s, c) => s + c.totalPending, 0);

  // Monthly collections data
  const monthlyData = useMemo(() => MONTHS.map(month => {
    const monthPayments = fyPayments.filter(p => p.paidTermFrom === month);
    return { month: month.slice(0, 3), collected: monthPayments.reduce((s, p) => s + p.payment, 0), count: monthPayments.length };
  }), [fyPayments]);

  // Handler performance
  const handlerData = useMemo(() => handlers.filter(h => h.active).map(h => {
    const hClients = fyClients.filter(c => c.handlerCode === h.code);
    const hPayments = fyPayments.filter(p => p.handlerCode === h.code);
    return {
      name: h.name.split(' ')[0],
      code: h.code,
      clients: hClients.length,
      collected: hPayments.reduce((s, p) => s + p.payment, 0),
      pending: hClients.reduce((s, c) => s + c.totalPending, 0),
    };
  }).filter(h => h.clients > 0), [handlers, fyClients, fyPayments]);

  // Client distribution pie
  const clientDistribution = useMemo(() => handlerData.map(h => ({ name: h.name, value: h.clients })), [handlerData]);

  // Aging buckets
  const agingData = useMemo(() => {
    const buckets = { '0-30': 0, '30-60': 0, '60-90': 0, '90+': 0 };
    fyClients.filter(c => c.totalPending > 0).forEach(c => {
      const lastP = fyPayments.filter(p => p.clientId === c.clientId).sort((a, b) => b.date.localeCompare(a.date))[0];
      const days = lastP ? Math.floor((Date.now() - new Date(lastP.date).getTime()) / 86400000) : 999;
      if (days > 90) buckets['90+']++;
      else if (days > 60) buckets['60-90']++;
      else if (days > 30) buckets['30-60']++;
      else buckets['0-30']++;
    });
    return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
  }, [fyClients, fyPayments]);

  const tabs: { key: ReportTab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'collections', label: 'Monthly Collections', icon: IndianRupee },
    { key: 'handlers', label: 'Handler Performance', icon: Users },
    { key: 'invoices', label: 'Invoice History', icon: FileText },
    { key: 'aging', label: 'Aging Dues', icon: Clock },
    { key: 'approvals', label: 'Approval Stats', icon: CheckCircle },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="erp-page-title flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Advanced Reports & Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} — Comprehensive Reporting Dashboard</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-3 h-3" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="erp-kpi-card text-center"><p className="text-xs text-muted-foreground">Total Clients</p><p className="text-2xl font-bold erp-mono">{fyClients.length}</p></div>
            <div className="erp-kpi-card text-center"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-lg font-bold erp-mono">{formatCurrency(totalRevenue)}</p></div>
            <div className="erp-kpi-card text-center"><p className="text-xs text-muted-foreground">Collected</p><p className="text-lg font-bold erp-mono text-[hsl(var(--success))]">{formatCurrency(totalCollected)}</p></div>
            <div className="erp-kpi-card text-center"><p className="text-xs text-muted-foreground">Pending</p><p className="text-lg font-bold erp-mono text-destructive">{formatCurrency(totalPending)}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="erp-kpi-card">
              <h3 className="text-sm font-semibold mb-3">Monthly Collection Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="collected" stroke="hsl(152, 60%, 40%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="erp-kpi-card">
              <h3 className="text-sm font-semibold mb-3">Client Distribution</h3>
              {clientDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={clientDistribution} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {clientDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-muted-foreground text-sm py-12">No data</p>}
            </div>
          </div>
        </>
      )}

      {tab === 'collections' && (
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-3">Monthly Collections Breakdown</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="collected" fill="hsl(152, 60%, 40%)" name="Collected" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'handlers' && (
        <>
          <div className="erp-kpi-card">
            <h3 className="text-sm font-semibold mb-3">Handler Collection vs Pending</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={handlerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="collected" fill="hsl(152, 60%, 40%)" name="Collected" />
                <Bar dataKey="pending" fill="hsl(0, 72%, 51%)" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="erp-kpi-card p-0 overflow-auto">
            <table className="erp-table">
              <thead><tr><th>Code</th><th>Handler</th><th>Clients</th><th className="text-right">Collected</th><th className="text-right">Pending</th></tr></thead>
              <tbody>
                {handlerData.map(h => (
                  <tr key={h.code}>
                    <td className="erp-mono text-xs">{h.code}</td>
                    <td className="text-xs font-medium">{h.name}</td>
                    <td className="erp-mono text-xs">{h.clients}</td>
                    <td className="erp-mono text-xs text-right">{formatCurrency(h.collected)}</td>
                    <td className="erp-mono text-xs text-right text-destructive">{formatCurrency(h.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'invoices' && (
        <div className="erp-kpi-card p-0 overflow-auto">
          <div className="px-4 py-3 border-b bg-muted/50"><h2 className="text-sm font-semibold">Invoice History ({fyInvoices.length} invoices)</h2></div>
          <table className="erp-table">
            <thead><tr><th>Invoice No</th><th>Date</th><th>Client</th><th>Handler</th><th className="text-right">Total</th><th>Status</th></tr></thead>
            <tbody>
              {fyInvoices.slice(0, 50).map(inv => (
                <tr key={inv.id}>
                  <td className="erp-mono text-xs font-semibold">{inv.invoiceNo}</td>
                  <td className="erp-mono text-xs">{inv.date}</td>
                  <td className="text-xs">{inv.clientName}</td>
                  <td className="erp-mono text-xs">{inv.handlerCode}</td>
                  <td className="erp-mono text-xs text-right font-bold">{formatCurrency(inv.total)}</td>
                  <td><span className={`erp-badge ${inv.status === 'paid' ? 'erp-badge-success' : 'erp-badge-warning'}`}>{(inv.status || 'pending').toUpperCase()}</span></td>
                </tr>
              ))}
              {fyInvoices.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No invoices</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'aging' && (
        <>
          <div className="erp-kpi-card">
            <h3 className="text-sm font-semibold mb-3">Aging Due Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" name="Clients" radius={[4, 4, 0, 0]}>
                  {agingData.map((_, i) => <Cell key={i} fill={['#10b981', '#f59e0b', '#f97316', '#ef4444'][i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {agingData.map((b, i) => (
              <div key={b.bucket} className="erp-kpi-card text-center">
                <p className="text-xs text-muted-foreground">{b.bucket} days</p>
                <p className={`text-2xl font-bold erp-mono ${i >= 2 ? 'text-destructive' : i === 1 ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--success))]'}`}>{b.count}</p>
                <p className="text-[10px] text-muted-foreground">clients</p>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'approvals' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="erp-kpi-card text-center">
            <p className="text-xs text-muted-foreground">Total Payments</p>
            <p className="text-2xl font-bold erp-mono">{fyPayments.length}</p>
          </div>
          <div className="erp-kpi-card text-center">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className="text-lg font-bold erp-mono">{formatCurrency(totalCollected)}</p>
          </div>
          <div className="erp-kpi-card text-center">
            <p className="text-xs text-muted-foreground">Invoices Generated</p>
            <p className="text-2xl font-bold erp-mono">{fyInvoices.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
