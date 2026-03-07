import React, { useState, useMemo } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { MONTHS } from '@/lib/erp-types';
import { Calendar, TrendingUp, AlertTriangle, IndianRupee, Clock, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

type ClientStatus = 'paid' | 'partial' | 'pending' | 'pending_approval';

function getStatusColor(status: ClientStatus) {
  switch (status) {
    case 'paid': return 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]';
    case 'partial': return 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.3)]';
    case 'pending': return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'pending_approval': return 'bg-[hsl(var(--info)/0.15)] text-[hsl(var(--info))] border-[hsl(var(--info)/0.3)]';
  }
}

function getStatusLabel(status: ClientStatus) {
  switch (status) {
    case 'paid': return 'Paid';
    case 'partial': return 'Partial';
    case 'pending': return 'Pending';
    case 'pending_approval': return 'Awaiting Approval';
  }
}

export default function CollectionDashboard() {
  const { clients, payments, handlers, currentFY } = useERP();
  const { isAdmin } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fyClients = useMemo(() => clients.filter(c => c.financialYear === currentFY), [clients, currentFY]);
  const fyPayments = useMemo(() => payments.filter(p => p.financialYear === currentFY), [payments, currentFY]);

  const totalExpected = useMemo(() => fyClients.reduce((s, c) => s + c.oldFeeDue + c.newFeeDue, 0), [fyClients]);
  const totalCollected = useMemo(() => fyPayments.reduce((s, p) => s + p.payment, 0), [fyPayments]);
  const totalPending = useMemo(() =>
  fyClients.reduce((s, c) => {

    const totalDue =
      Number(c.oldFeeDue || 0) +
      Number(c.newFeeDue || 0);

    const paid = Number(c.totalPaidFY || 0);

    return s + Math.max(0, totalDue - paid);

  }, 0),
  [fyClients]);
  const pendingApproval = useMemo(() => fyPayments.filter(p => (p as any).approvalStatus === 'pending_approval').length, [fyPayments]);
  const agingDues = useMemo(() => fyClients.filter(c => c.totalPending > 0).length, [fyClients]);

  // Monthly data
  const monthlyData = useMemo(() => {
    return MONTHS.map(month => {
      const monthPayments = fyPayments.filter(p => p.paidTermFrom === month || p.paidTermTo === month);
      const collected = monthPayments.reduce((s, p) => s + p.payment, 0);
      const expected = fyClients.reduce((s, c) => s + (c.newFee || c.oldFee), 0);
      return { month, collected, expected, count: monthPayments.length };
    });
  }, [fyPayments, fyClients]);

  // Client view for selected month
  const monthClients = useMemo(() => {
    if (!selectedMonth) return [];
    return fyClients.map(c => {
      const clientPayments = fyPayments.filter(p => p.clientId === c.clientId && (p.paidTermFrom === selectedMonth || p.paidTermTo === selectedMonth));
      const paidAmount = clientPayments.reduce((s, p) => s + p.payment, 0);
      const monthFee = c.newFee || c.oldFee;
      const totalPayable = c.totalPending + monthFee;
      const remainingDue = Math.max(0, totalPayable - paidAmount);
      const hasPendingApproval = clientPayments.some(p => (p as any).approvalStatus === 'pending_approval');

      let status: ClientStatus = 'pending';
      if (hasPendingApproval) status = 'pending_approval';
      else if (paidAmount >= totalPayable) status = 'paid';
      else if (paidAmount > 0) status = 'partial';

      return {
        ...c,
        serviceType: 'Professional Services',
        previousDue: c.totalPending,
        currentMonthFee: monthFee,
        totalPayable,
        paidAmount,
        remainingDue,
        status,
        handler: handlers.find(h => h.code === c.handlerCode)?.name || c.handlerCode,
      };
    }).filter(c => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.clientId.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [selectedMonth, fyClients, fyPayments, handlers, search, statusFilter]);

  const topKPIs = [
    { label: 'Total Expected', value: formatCurrency(totalExpected), icon: TrendingUp, color: 'text-[hsl(var(--erp-kpi-blue))]', bg: 'bg-[hsl(var(--erp-kpi-blue)/0.08)]' },
    { label: 'Collected (Approved)', value: formatCurrency(totalCollected), icon: IndianRupee, color: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success)/0.08)]' },
    { label: 'Pending Collections', value: formatCurrency(totalPending), icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/5' },
    { label: 'Pending Approval', value: pendingApproval, icon: Clock, color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning)/0.08)]' },
    { label: 'Aging Dues Alerts', value: agingDues, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/5' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><Calendar className="w-5 h-5" /> Monthly Collection Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} — Real-time Collection Overview</p>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {topKPIs.map(k => (
          <div key={k.label} className="erp-kpi-card flex items-start gap-3">
            <div className={`${k.bg} p-2 rounded-sm`}><k.icon className={`w-4 h-4 ${k.color}`} /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className="text-base font-bold erp-mono">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Boxes */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Monthly Collection Grid</h2>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
          {monthlyData.map(m => {
            const pct = m.expected > 0 ? Math.min(100, (m.collected / m.expected) * 100) : 0;
            const isSelected = selectedMonth === m.month;
            return (
              <button
                key={m.month}
                onClick={() => setSelectedMonth(isSelected ? null : m.month)}
                className={`erp-kpi-card text-left cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
              >
                <p className="text-xs font-semibold">{m.month}</p>
                <p className="erp-mono text-sm font-bold text-[hsl(var(--success))]">{formatCurrency(m.collected)}</p>
                <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-[hsl(var(--success))]' : pct >= 40 ? 'bg-[hsl(var(--warning))]' : 'bg-destructive'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.count} entries</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Monthly Client View */}
      {selectedMonth && (
        <Dialog open={!!selectedMonth} onOpenChange={() => setSelectedMonth(null)}>
          <DialogContent className="max-w-5xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-4 h-4" /> {selectedMonth} — Client Collection View
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search client name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-sm px-2 py-2 text-xs bg-background">
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="pending">Pending</option>
                <option value="pending_approval">Awaiting Approval</option>
              </select>
            </div>
            <div className="overflow-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>Client ID</th>
                    <th>Service Type</th>
                    <th className="text-right">Previous Due</th>
                    <th className="text-right">Month Fee</th>
                    <th className="text-right">Total Payable</th>
                    <th className="text-right">Paid Amount</th>
                    <th className="text-right">Remaining Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthClients.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-muted-foreground text-sm">No clients found</td></tr>
                  )}
                  {monthClients.map(c => (
                    <tr key={c.id}>
                      <td className="text-xs font-medium">{c.name}</td>
                      <td className="erp-mono text-xs">{c.clientId}</td>
                      <td className="text-xs">{c.serviceType}</td>
                      <td className="erp-mono text-xs text-right">{formatCurrency(c.previousDue)}</td>
                      <td className="erp-mono text-xs text-right">{formatCurrency(c.currentMonthFee)}</td>
                      <td className="erp-mono text-xs text-right font-semibold">{formatCurrency(c.totalPayable)}</td>
                      <td className="erp-mono text-xs text-right">{formatCurrency(c.paidAmount)}</td>
                      <td className="erp-mono text-xs text-right font-bold">{formatCurrency(c.remainingDue)}</td>
                      <td>
                        <span className={`erp-badge border text-[10px] ${getStatusColor(c.status)}`}>
                          {getStatusLabel(c.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
