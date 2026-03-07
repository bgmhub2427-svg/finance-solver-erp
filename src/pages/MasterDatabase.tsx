import React, { useMemo, useState } from 'react';
import { useERP } from '@/lib/erp-store';
import { Database, Search } from 'lucide-react';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function MasterDatabase() {
  const { clients, payments, invoices, currentFY } = useERP();
  const seedQuery = localStorage.getItem('erp_global_search') || '';
  const [query, setQuery] = useState(seedQuery);

  const fyClients = clients.filter(c => c.financialYear === currentFY);
  const fyPayments = payments.filter(p => p.financialYear === currentFY);
  const fyInvoices = invoices.filter(i => i.financialYear === currentFY);

  const normalized = query.trim().toLowerCase();

  const filteredClients = useMemo(() => {
    if (!normalized) return fyClients;
    return fyClients.filter((c) => {
      const paymentMatch = fyPayments.some((p) => p.clientId === c.clientId && (`${p.payment}`.includes(normalized) || p.reason.toLowerCase().includes(normalized)));
      const invoiceMatch = fyInvoices.some((i) => i.clientId === c.clientId && (i.invoiceNo.toLowerCase().includes(normalized) || `${i.total}`.includes(normalized)));
      return (
        c.clientId.toLowerCase().includes(normalized) ||
        c.name.toLowerCase().includes(normalized) ||
        c.gstNumber.toLowerCase().includes(normalized) ||
        paymentMatch ||
        invoiceMatch
      );
    });
  }, [normalized, fyClients, fyPayments, fyInvoices]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="erp-page-title flex items-center gap-2"><Database className="w-5 h-5" /> Master Database</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Complete data consolidation — FY {currentFY}</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            localStorage.setItem('erp_global_search', e.target.value);
          }}
          placeholder="Search clients/GST/invoices/payments"
          className="w-full h-9 rounded-sm border border-input bg-background pl-8 pr-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="erp-kpi-card text-center">
          <p className="text-xs text-muted-foreground">Total Clients</p>
          <p className="text-2xl font-bold erp-mono">{filteredClients.length}</p>
        </div>
        <div className="erp-kpi-card text-center">
          <p className="text-xs text-muted-foreground">Total Payments</p>
          <p className="text-2xl font-bold erp-mono">{fyPayments.length}</p>
        </div>
        <div className="erp-kpi-card text-center">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold erp-mono">{formatCurrency(filteredClients.reduce((s, c) => s + c.oldFeeDue + c.newFeeDue, 0))}</p>
        </div>
      </div>

      <div className="erp-kpi-card p-0 overflow-auto">
        <div className="px-4 py-3 border-b bg-muted/50">
          <h2 className="text-sm font-semibold">All Client Records</h2>
        </div>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Name</th>
              <th>GST</th>
              <th>Handler</th>
              <th className="text-right">Old Fee</th>
              <th>End Month</th>
              <th className="text-right">Old Due</th>
              <th className="text-right">New Fee</th>
              <th>Start Month</th>
              <th className="text-right">New Due</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Pending</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 && (
              <tr><td colSpan={12} className="text-center py-8 text-muted-foreground text-sm">No data in master database.</td></tr>
            )}
            {filteredClients.map(c => (
              <tr key={c.id}>
                <td className="erp-mono text-xs">{c.clientId}</td>
                <td className="text-xs font-medium">{c.name}</td>
                <td className="erp-mono text-xs">{c.gstNumber || '—'}</td>
                <td className="erp-mono text-xs">{c.handlerCode}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.oldFee)}</td>
                <td className="text-xs">{c.oldFeeEndMonth}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.oldFeeDue)}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.newFee)}</td>
                <td className="text-xs">{c.newFeeStartMonth}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.newFeeDue)}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.totalPaidFY)}</td>
                <td className="erp-mono text-xs text-right font-bold">{formatCurrency(c.totalPending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
