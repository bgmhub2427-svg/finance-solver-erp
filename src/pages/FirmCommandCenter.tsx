import React, { useMemo } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { miniDB } from '@/lib/mini-supabase';
import {
  TrendingUp, TrendingDown, IndianRupee, Wallet, BarChart3,
  Users, AlertTriangle, Target, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const CHART_COLORS = [
  'hsl(217, 91%, 60%)', 'hsl(172, 66%, 50%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)', 'hsl(280, 67%, 55%)', 'hsl(160, 84%, 39%)',
];

export default function FirmCommandCenter() {
  const { clients, payments, invoices, handlers, currentFY } = useERP();
  const { isAdmin } = useAuth();
  const [expenses, setExpenses] = React.useState<any[]>([]);

  React.useEffect(() => {
    miniDB.from('expenses').select('*').then(({ data }) => {
      if (data) setExpenses(data);
    });
  }, []);

  const fyClients = useMemo(() => clients.filter(c => c.financialYear === currentFY), [clients, currentFY]);
  const fyPayments = useMemo(() => payments.filter(p => p.financialYear === currentFY), [payments, currentFY]);
  const fyInvoices = useMemo(() => invoices.filter(i => i.financialYear === currentFY), [invoices, currentFY]);

  // Monthly revenue data
  const monthlyData = useMemo(() => {
    const map = new Map<string, { revenue: number; expenses: number }>();
    fyPayments.forEach(p => {
      const m = p.date.slice(0, 7);
      const entry = map.get(m) || { revenue: 0, expenses: 0 };
      entry.revenue += p.payment;
      map.set(m, entry);
    });
    expenses.forEach(e => {
      const m = e.date?.slice(0, 7);
      if (m) {
        const entry = map.get(m) || { revenue: 0, expenses: 0 };
        entry.expenses += Number(e.amount || 0);
        map.set(m, entry);
      }
    });
    return Array.from(map.entries())
      .map(([month, data]) => ({ month, ...data, profit: data.revenue - data.expenses }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [fyPayments, expenses]);

  // Core metrics
  const totalRevenue = fyPayments.reduce((s, p) => s + p.payment, 0);
  const totalPending = fyClients.reduce((s, c) => s + c.totalPending, 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRevenue = fyPayments.filter(p => p.date.slice(0, 7) === thisMonth).reduce((s, p) => s + p.payment, 0);
  const monthExpenses = expenses.filter(e => e.date?.slice(0, 7) === thisMonth).reduce((s, e) => s + Number(e.amount || 0), 0);

  // Service revenue breakdown
  const serviceRevenue = useMemo(() => {
    const map = new Map<string, number>();
    fyInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const key = item.description || 'Other';
        map.set(key, (map.get(key) || 0) + item.amount);
      });
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [fyInvoices]);

  // Top clients
  const topClients = useMemo(() => {
    return [...fyClients]
      .sort((a, b) => b.totalPaidFY - a.totalPaidFY)
      .slice(0, 5)
      .map(c => ({ name: c.name, revenue: c.totalPaidFY, pending: c.totalPending }));
  }, [fyClients]);

  // Handler performance
  const handlerStats = useMemo(() => {
    return handlers.map(h => {
      const hClients = fyClients.filter(c => c.handlerCode === h.code);
      const collected = hClients.reduce((s, c) => s + c.totalPaidFY, 0);
      const pending = hClients.reduce((s, c) => s + c.totalPending, 0);
      return { name: h.name || h.code, clients: hClients.length, collected, pending, ratio: collected + pending > 0 ? ((collected / (collected + pending)) * 100).toFixed(1) : '0' };
    }).filter(h => h.clients > 0);
  }, [handlers, fyClients]);

  // Pending trend (last 6 months)
  const pendingTrend = useMemo(() => {
    const months = monthlyData.slice(-6);
    let runningPending = totalPending;
    return months.map(m => {
      return { month: m.month, pending: Math.max(0, runningPending - m.revenue + m.expenses) };
    });
  }, [monthlyData, totalPending]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Admin access required for Command Center.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="erp-page-title flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Firm Command Center</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Financial analytics & intelligence — FY {currentFY}</p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<TrendingUp className="w-4 h-4" />} color="bg-success/10" textColor="text-success" />
        <KPICard label="Total Pending" value={formatCurrency(totalPending)} icon={<AlertTriangle className="w-4 h-4" />} color="bg-destructive/10" textColor="text-destructive" />
        <KPICard label="Total Expenses" value={formatCurrency(totalExpenses)} icon={<Wallet className="w-4 h-4" />} color="bg-warning/10" textColor="text-warning" />
        <KPICard label="Net Profit" value={formatCurrency(netProfit)} icon={netProfit >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          color={netProfit >= 0 ? 'bg-success/10' : 'bg-destructive/10'} textColor={netProfit >= 0 ? 'text-success' : 'text-destructive'} />
      </div>

      {/* Monthly sub-KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="erp-kpi-card">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">This Month Revenue</p>
          <p className="text-xl font-bold erp-mono mt-1">{formatCurrency(monthRevenue)}</p>
        </div>
        <div className="erp-kpi-card">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">This Month Expenses</p>
          <p className="text-xl font-bold erp-mono mt-1">{formatCurrency(monthExpenses)}</p>
        </div>
      </div>

      {/* Revenue vs Expense Chart */}
      {monthlyData.length > 0 && (
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Revenue vs Expenses
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="revenue" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="expenses" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Profit Trend + Service Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Profit Trend */}
        {monthlyData.length > 0 && (
          <div className="erp-kpi-card">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Monthly Profit Trend
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="profit" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={{ r: 3 }} name="Net Profit" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Service Revenue */}
        {serviceRevenue.length > 0 && (
          <div className="erp-kpi-card">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Revenue by Service
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={serviceRevenue} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                  {serviceRevenue.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Clients + Handler Performance side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 Clients by Revenue */}
        <div className="erp-kpi-card p-0 overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-muted/30">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Top Clients by Revenue
            </h3>
          </div>
          <table className="erp-table">
            <thead><tr><th>Client</th><th className="text-right">Revenue</th><th className="text-right">Pending</th></tr></thead>
            <tbody>
              {topClients.length === 0 && <tr><td colSpan={3} className="text-center py-6 text-muted-foreground text-sm">No data</td></tr>}
              {topClients.map(c => (
                <tr key={c.name}>
                  <td className="text-xs font-medium">{c.name}</td>
                  <td className="erp-mono text-xs text-right text-success font-semibold">{formatCurrency(c.revenue)}</td>
                  <td className="erp-mono text-xs text-right">{formatCurrency(c.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Handler Performance */}
        <div className="erp-kpi-card p-0 overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-muted/30">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Handler Performance
            </h3>
          </div>
          <table className="erp-table">
            <thead><tr><th>Handler</th><th>Clients</th><th className="text-right">Collected</th><th>Rate</th></tr></thead>
            <tbody>
              {handlerStats.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-sm">No data</td></tr>}
              {handlerStats.map(h => (
                <tr key={h.name}>
                  <td className="text-xs font-medium">{h.name}</td>
                  <td className="erp-mono text-xs">{h.clients}</td>
                  <td className="erp-mono text-xs text-right text-success font-semibold">{formatCurrency(h.collected)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${h.ratio}%` }} />
                      </div>
                      <span className="erp-mono text-[10px]">{h.ratio}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, color, textColor }: { label: string; value: string; icon: React.ReactNode; color: string; textColor: string }) {
  return (
    <div className="erp-kpi-card flex items-start gap-3">
      <div className={`kpi-icon-box ${color}`}>
        <span className={textColor}>{icon}</span>
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <p className="kpi-value erp-mono">{value}</p>
      </div>
    </div>
  );
}
