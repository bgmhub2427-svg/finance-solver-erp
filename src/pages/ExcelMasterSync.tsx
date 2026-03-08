import React, { useMemo } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { FileSpreadsheet, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { playSyncSuccess } from '@/lib/sound-engine';
import { calculateFeeForRange } from '@/lib/fee-calculator';
import { MONTHS } from '@/lib/erp-types';
import * as XLSX from 'xlsx';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function ExcelMasterSync() {
  const { clients, payments, invoices, handlers, currentFY } = useERP();
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const fyClients = useMemo(() => clients.filter(c => c.financialYear === currentFY), [clients, currentFY]);
  const fyPayments = useMemo(() => payments.filter(p => p.financialYear === currentFY), [payments, currentFY]);
  const fyInvoices = useMemo(() => invoices.filter(i => i.financialYear === currentFY), [invoices, currentFY]);

  const generateMasterExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Master Ledger (Payments)
    const ledgerHeaders = ['Payment ID', 'Date', 'Client ID', 'Client Name', 'Handler', 'Month From', 'Month To', 'Old Fee', 'New Fee', 'Due Amount', 'Payment Amount', 'Pending', 'Payment Method', 'UTR Number', 'Remarks', 'Approval Status'];
    const ledgerRows = fyPayments.map(p => {
      const handler = handlers.find(h => h.code === p.handlerCode);
      return [
        (p as any).paymentId || p.id,
        p.date,
        p.clientId,
        p.clientName,
        handler?.name || p.handlerCode,
        p.paidTermFrom,
        p.paidTermTo,
        p.oldFee,
        p.newFee,
        p.dueAmount,
        p.payment,
        p.pending,
        (p.paymentMode || 'cash').toUpperCase(),
        (p as any).utrNumber || '',
        p.remarks,
        p.approvalStatus || 'approved',
      ];
    });
    const wsLedger = XLSX.utils.aoa_to_sheet([ledgerHeaders, ...ledgerRows]);
    wsLedger['!cols'] = ledgerHeaders.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, wsLedger, 'Payment Ledger');

    // Sheet 2: Client Master
    const clientHeaders = ['Client ID', 'Name', 'Phone', 'GST', 'PAN', 'Status', 'Handler', 'Old Fee', 'Old Fee End', 'Old Fee Due', 'New Fee', 'New Fee Start', 'New Fee Due', 'Total Paid FY', 'Total Pending'];
    const clientRows = fyClients.map(c => [
      c.clientId, c.name, c.phone, c.gstNumber, c.pan || '', c.status || 'active', c.handlerCode,
      c.oldFee, c.oldFeeEndMonth, c.oldFeeDue, c.newFee, c.newFeeStartMonth, c.newFeeDue,
      c.totalPaidFY, c.totalPending,
    ]);
    const wsClients = XLSX.utils.aoa_to_sheet([clientHeaders, ...clientRows]);
    wsClients['!cols'] = clientHeaders.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, wsClients, 'Client Master');

    // Sheet 3: Invoices
    const invoiceHeaders = ['Invoice No', 'Date', 'Client ID', 'Client Name', 'Handler', 'Status', 'Subtotal', 'GST', 'Total'];
    const invoiceRows = fyInvoices.map(inv => [
      inv.invoiceNo, inv.date, inv.clientId, inv.clientName, inv.handlerCode,
      inv.status || 'pending', inv.subtotal, inv.gst, inv.total,
    ]);
    const wsInvoices = XLSX.utils.aoa_to_sheet([invoiceHeaders, ...invoiceRows]);
    wsInvoices['!cols'] = invoiceHeaders.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices');

    // Sheet 4: Monthly Summary
    const months = MONTHS;
    const monthSummary = months.map(m => {
      const monthPayments = fyPayments.filter(p => p.paidTermFrom === m);
      return [m, monthPayments.length, monthPayments.reduce((s, p) => s + p.payment, 0)];
    });
    const wsSummary = XLSX.utils.aoa_to_sheet([['Month', 'Entries', 'Total Collected'], ...monthSummary]);
    wsSummary['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Monthly Summary');

    // Sheet 5: Handler Performance
    const handlerPerf = handlers.filter(h => h.active).map(h => {
      const hClients = fyClients.filter(c => c.handlerCode === h.code);
      const hPayments = fyPayments.filter(p => p.handlerCode === h.code);
      const collected = hPayments.reduce((s, p) => s + p.payment, 0);
      const pending = hClients.reduce((s, c) => s + c.totalPending, 0);
      const completionRate = hClients.length > 0 ? ((hClients.filter(c => c.totalPending <= 0).length / hClients.length) * 100).toFixed(1) : '0';
      return [h.code, h.name, hClients.length, collected, pending, completionRate + '%'];
    });
    const wsHandler = XLSX.utils.aoa_to_sheet([['Handler Code', 'Handler Name', 'Clients', 'Collected', 'Pending', 'Completion Rate'], ...handlerPerf]);
    wsHandler['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsHandler, 'Handler Performance');

    // Sheet 6: Pending Calculations
    const pendingHeaders = ['Client ID', 'Client Name', 'Handler', 'Old Fee', 'Old Fee End', 'New Fee', 'New Fee Start', 'Old Fee Due', 'New Fee Due', 'Total Due', 'Total Paid', 'Pending Amount', 'Last Payment', 'Days Since Payment'];
    const pendingRows = fyClients.filter(c => c.totalPending > 0).map(c => {
      const lastPayment = fyPayments.filter(p => p.clientId === c.clientId).sort((a, b) => b.date.localeCompare(a.date))[0];
      const daysOverdue = lastPayment ? Math.floor((Date.now() - new Date(lastPayment.date).getTime()) / 86400000) : 999;
      return [
        c.clientId, c.name, c.handlerCode,
        c.oldFee, c.oldFeeEndMonth, c.newFee, c.newFeeStartMonth,
        c.oldFeeDue, c.newFeeDue, c.oldFeeDue + c.newFeeDue,
        c.totalPaidFY, c.totalPending,
        lastPayment?.date || 'N/A', daysOverdue,
      ];
    });
    const wsPending = XLSX.utils.aoa_to_sheet([pendingHeaders, ...pendingRows]);
    wsPending['!cols'] = pendingHeaders.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, wsPending, 'Pending Calculations');

    const fileName = `Master-ERP-${currentFY}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    playSyncSuccess();
    toast({ title: 'Master Excel exported', description: `${fileName} downloaded with 6 sheets` });
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Admin access required</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Excel Master Sync</h1>
          <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} — Complete ERP data export</p>
        </div>
        <Button onClick={generateMasterExcel} className="gap-1">
          <Download className="w-3.5 h-3.5" /> Export Master Excel
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">📊 Payment Ledger</h3>
          <p className="text-xs text-muted-foreground mb-2">Complete payment records with IDs, amounts, modes, UTR numbers.</p>
          <p className="erp-mono text-sm font-bold">{fyPayments.length} records</p>
        </div>
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">👥 Client Master</h3>
          <p className="text-xs text-muted-foreground mb-2">All client details with fee structures and pending amounts.</p>
          <p className="erp-mono text-sm font-bold">{fyClients.length} clients</p>
        </div>
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">🧾 Invoices</h3>
          <p className="text-xs text-muted-foreground mb-2">All invoices with items, GST, totals.</p>
          <p className="erp-mono text-sm font-bold">{fyInvoices.length} invoices</p>
        </div>
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">📅 Monthly Summary</h3>
          <p className="text-xs text-muted-foreground mb-2">Month-wise collection totals and entry counts.</p>
          <p className="erp-mono text-sm font-bold">12 months</p>
        </div>
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">👤 Handler Performance</h3>
          <p className="text-xs text-muted-foreground mb-2">Per-handler metrics and completion rates.</p>
          <p className="erp-mono text-sm font-bold">{handlers.filter(h => h.active).length} handlers</p>
        </div>
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">⚠️ Pending Calculations</h3>
          <p className="text-xs text-muted-foreground mb-2">Detailed pending breakdown with fee structures.</p>
          <p className="erp-mono text-sm font-bold">{fyClients.filter(c => c.totalPending > 0).length} pending</p>
        </div>
      </div>

      {/* Preview: Pending */}
      <div className="erp-kpi-card p-0 overflow-auto">
        <div className="px-4 py-3 border-b bg-muted/50">
          <h2 className="text-sm font-semibold">Preview: Pending Calculations</h2>
        </div>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Client Name</th>
              <th>Handler</th>
              <th className="text-right">Old Fee</th>
              <th className="text-right">New Fee</th>
              <th className="text-right">Total Due</th>
              <th className="text-right">Paid</th>
              <th className="text-right">Pending</th>
            </tr>
          </thead>
          <tbody>
            {fyClients.filter(c => c.totalPending > 0).slice(0, 10).map(c => (
              <tr key={c.id}>
                <td className="erp-mono text-xs">{c.clientId}</td>
                <td className="text-xs font-medium">{c.name}</td>
                <td className="erp-mono text-xs">{c.handlerCode}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.oldFee)}/mo</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.newFee)}/mo</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.oldFeeDue + c.newFeeDue)}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(c.totalPaidFY)}</td>
                <td className="erp-mono text-xs text-right font-bold text-destructive">{formatCurrency(c.totalPending)}</td>
              </tr>
            ))}
            {fyClients.filter(c => c.totalPending > 0).length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-muted-foreground text-sm">No pending dues — all clear ✓</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
