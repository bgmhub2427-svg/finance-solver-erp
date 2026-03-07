import React, { useState } from 'react';
import { useERP } from '@/lib/erp-store';
import { ClipboardCheck } from 'lucide-react';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function PendingChecklist() {
  const { clients, handlers, currentFY } = useERP();
  const [handlerFilter, setHandlerFilter] = useState('ALL');

  const pendingClients = clients
    .filter(c => c.financialYear === currentFY)
    .filter(c => {
    const due =
      Number(c.oldFeeDue || 0) +
      Number(c.newFeeDue || 0);

  const paid = Number(c.totalPaidFY || 0);

  return due - paid > 0;
})
    .filter(c => handlerFilter === 'ALL' || c.handlerCode === handlerFilter);

  const totalPending = pendingClients.reduce((s, c) => s + c.totalPending, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> Payment Pending Checklist</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{pendingClients.length} clients with pending dues — FY {currentFY}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter by Handler:</span>
          <select value={handlerFilter} onChange={e => setHandlerFilter(e.target.value)} className="border rounded-sm px-2 py-1 text-xs bg-background">
            <option value="ALL">All Handlers</option>
            {handlers.map(h => <option key={h.code} value={h.code}>{h.code} — {h.name}</option>)}
          </select>
        </div>
      </div>

      <div className="erp-kpi-card flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Total Pending Amount:</span>
        <span className="text-xl font-bold erp-mono text-destructive">{formatCurrency(totalPending)}</span>
      </div>

      <div className="erp-kpi-card p-0 overflow-auto">
        <table className="erp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Client ID</th>
              <th>Client Name</th>
              <th>Handler</th>
              <th className="text-right">Old Fee Due</th>
              <th className="text-right">New Fee Due</th>
              <th className="text-right">Total Due</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Pending</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pendingClients.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-muted-foreground text-sm">No pending dues — all clear! ✓</td></tr>
            )}
            {pendingClients.map((c, i) => (
              <tr key={c.id}>
                <td className="erp-mono text-xs">{i + 1}</td>
                <td className="erp-mono text-xs">{c.clientId}</td>
                <td className="text-xs font-medium">{c.name}</td>
                <td className="erp-mono text-xs">{c.handlerCode}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.oldFeeDue)}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.newFeeDue)}</td>
                <td className="erp-mono text-xs text-right font-bold">{formatCurrency(c.oldFeeDue + c.newFeeDue)}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.totalPaidFY)}</td>
                <td className="erp-mono text-xs text-right font-bold text-destructive">{formatCurrency(c.totalPending)}</td>
                <td><span className="erp-badge erp-badge-danger">OVERDUE</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
