import React, { useMemo } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { FileSpreadsheet, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function ExcelMasterSync() {
  const { clients, payments, handlers, currentFY } = useERP();
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const fyClients = useMemo(() => clients.filter(c => c.financialYear === currentFY), [clients, currentFY]);
  const fyPayments = useMemo(() => payments.filter(p => p.financialYear === currentFY), [payments, currentFY]);

  const generateMasterExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Master Ledger
    const ledgerHeaders = ['Date', 'Client ID', 'Client Name', 'Handler', 'Month From', 'Month To', 'Payment Amount', 'Payment Method', 'UTR Number', 'Cash Notes', 'Adjustment', 'Closing Due', 'Remarks', 'Approval Status', 'Approved By'];
    const ledgerRows = fyPayments.map(p => {
      const client = fyClients.find(c => c.clientId === p.clientId);
      const handler = handlers.find(h => h.code === p.handlerCode);
      return [
        p.date,
        p.clientId,
        p.clientName,
        handler?.name || p.handlerCode,
        p.paidTermFrom,
        p.paidTermTo,
        p.payment,
        (p.paymentMode || 'cash').toUpperCase(),
        (p as any).utrNumber || '',
        (p as any).cashNotes || '',
        (p as any).adjustmentAmount || 0,
        p.pending,
        p.remarks,
        (p as any).approvalStatus || 'approved',
        (p as any).approvedBy || '',
      ];
    });
    const wsLedger = XLSX.utils.aoa_to_sheet([ledgerHeaders, ...ledgerRows]);
    wsLedger['!cols'] = ledgerHeaders.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, wsLedger, 'Master Ledger');

    // Sheet 2: Monthly Summary
    const months = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
    const monthSummary = months.map(m => {
      const monthPayments = fyPayments.filter(p => p.paidTermFrom === m);
      return [m, monthPayments.length, monthPayments.reduce((s, p) => s + p.payment, 0)];
    });
    const wsSummary = XLSX.utils.aoa_to_sheet([['Month', 'Entries', 'Total Collected'], ...monthSummary]);
    wsSummary['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Monthly Summary');

    // Sheet 3: Handler Performance
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

    // Sheet 4: Aging Due Report
    const agingClients = fyClients.filter(c => c.totalPending > 0).map(c => {
      const lastPayment = fyPayments.filter(p => p.clientId === c.clientId).sort((a, b) => b.date.localeCompare(a.date))[0];
      const lastDate = lastPayment ? lastPayment.date : 'N/A';
      const daysOverdue = lastPayment ? Math.floor((Date.now() - new Date(lastPayment.date).getTime()) / 86400000) : 999;
      const bucket = daysOverdue > 90 ? '90+' : daysOverdue > 60 ? '60-90' : daysOverdue > 30 ? '30-60' : '0-30';
      return [c.clientId, c.name, c.handlerCode, c.totalPending, lastDate, daysOverdue, bucket];
    });
    const wsAging = XLSX.utils.aoa_to_sheet([['Client ID', 'Client Name', 'Handler', 'Pending Amount', 'Last Payment', 'Days Overdue', 'Bucket'], ...agingClients]);
    wsAging['!cols'] = [{ wch: 14 }, { wch: 25 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsAging, 'Aging Due Report');

    const fileName = `Master-Collection-${currentFY}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast({ title: 'Master Excel exported', description: `${fileName} downloaded with 4 sheets` });
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Admin access required</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Excel Master Sync</h1>
          <p className="text-xs text-muted-foreground mt-0.5">FY {currentFY} — Multi-sheet Excel export</p>
        </div>
        <Button onClick={generateMasterExcel} className="gap-1">
          <Download className="w-3.5 h-3.5" /> Export Master Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">📊 Sheet 1 — Master Ledger</h3>
          <p className="text-xs text-muted-foreground mb-2">Complete payment records with client details, amounts, payment methods, UTR numbers, approval status.</p>
          <p className="erp-mono text-sm font-bold">{fyPayments.length} records</p>
        </div>
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">📅 Sheet 2 — Monthly Summary</h3>
          <p className="text-xs text-muted-foreground mb-2">Month-wise collection totals and entry counts for the financial year.</p>
          <p className="erp-mono text-sm font-bold">12 months</p>
        </div>
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">👤 Sheet 3 — Handler Performance</h3>
          <p className="text-xs text-muted-foreground mb-2">Per-handler metrics: clients managed, total collected, pending dues, completion rate.</p>
          <p className="erp-mono text-sm font-bold">{handlers.filter(h => h.active).length} handlers</p>
        </div>
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">⚠️ Sheet 4 — Aging Due Report</h3>
          <p className="text-xs text-muted-foreground mb-2">Clients with pending dues categorized by aging buckets (0-30, 30-60, 60-90, 90+ days).</p>
          <p className="erp-mono text-sm font-bold">{fyClients.filter(c => c.totalPending > 0).length} clients</p>
        </div>
      </div>

      {/* Preview Tables */}
      <div className="erp-kpi-card p-0 overflow-auto">
        <div className="px-4 py-3 border-b bg-muted/50">
          <h2 className="text-sm font-semibold">Preview: Aging Due Report</h2>
        </div>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Client Name</th>
              <th>Handler</th>
              <th className="text-right">Pending</th>
              <th>Last Payment</th>
              <th>Bucket</th>
            </tr>
          </thead>
          <tbody>
            {fyClients.filter(c => c.totalPending > 0).slice(0, 10).map(c => {
              const lastPayment = fyPayments.filter(p => p.clientId === c.clientId).sort((a, b) => b.date.localeCompare(a.date))[0];
              const daysOverdue = lastPayment ? Math.floor((Date.now() - new Date(lastPayment.date).getTime()) / 86400000) : 999;
              const bucket = daysOverdue > 90 ? '90+' : daysOverdue > 60 ? '60-90' : daysOverdue > 30 ? '30-60' : '0-30';
              return (
                <tr key={c.id}>
                  <td className="erp-mono text-xs">{c.clientId}</td>
                  <td className="text-xs font-medium">{c.name}</td>
                  <td className="erp-mono text-xs">{c.handlerCode}</td>
                  <td className="erp-mono text-xs text-right font-bold text-destructive">{formatCurrency(c.totalPending)}</td>
                  <td className="erp-mono text-xs">{lastPayment?.date || 'N/A'}</td>
                  <td>
                    <span className={`erp-badge ${bucket === '90+' ? 'erp-badge-danger' : bucket === '60-90' ? 'erp-badge-warning' : bucket === '30-60' ? 'erp-badge-info' : 'erp-badge-success'}`}>
                      {bucket} days
                    </span>
                  </td>
                </tr>
              );
            })}
            {fyClients.filter(c => c.totalPending > 0).length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-muted-foreground text-sm">No pending dues — all clear ✓</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
