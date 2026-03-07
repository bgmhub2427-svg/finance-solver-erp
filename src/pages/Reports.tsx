import React from 'react';
import { useERP } from '@/lib/erp-store';
import { TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

const COLORS = ['#0891b2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#e11d48'];

export default function Reports() {
  const { getDashboardStats, currentFY } = useERP();
  const stats = getDashboardStats();

  const barData = stats.handlerPerformance
    .filter(h => h.clients > 0)
    .map(h => ({ name: h.name, collected: h.collected, pending: h.pending }));

  const pieData = stats.handlerPerformance
    .filter(h => h.clients > 0)
    .map(h => ({ name: h.name, value: h.clients }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="erp-page-title flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Reports & Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} — Analytics</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="erp-kpi-card text-center">
          <p className="text-xs text-muted-foreground">Total Clients</p>
          <p className="text-2xl font-bold erp-mono">{stats.totalClients}</p>
        </div>
        <div className="erp-kpi-card text-center">
          <p className="text-xs text-muted-foreground">Revenue</p>
          <p className="text-lg font-bold erp-mono">{formatCurrency(stats.totalRevenue)}</p>
        </div>
        <div className="erp-kpi-card text-center">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="text-lg font-bold erp-mono text-[hsl(var(--success))]">{formatCurrency(stats.totalCollected)}</p>
        </div>
        <div className="erp-kpi-card text-center">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-lg font-bold erp-mono text-destructive">{formatCurrency(stats.totalPending)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-3">Handler Collection vs Pending</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Bar dataKey="collected" fill="hsl(152, 60%, 40%)" name="Collected" />
                <Bar dataKey="pending" fill="hsl(0, 72%, 51%)" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground text-sm py-12">No data to display</p>
          )}
        </div>

        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-3">Client Distribution by Handler</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground text-sm py-12">No data to display</p>
          )}
        </div>
      </div>
    </div>
  );
}
