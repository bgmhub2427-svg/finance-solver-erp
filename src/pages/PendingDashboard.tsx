import React, { useState, useMemo } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import {
  IndianRupee, AlertTriangle, Users, TrendingUp,
  Search, Filter, Eye, Plus, FileText, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function daysBetween(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

type PendingStatus = 'upcoming' | 'due_soon' | 'overdue' | 'critical';

function getStatus(daysPending: number, pending: number): PendingStatus {
  if (pending <= 0) return 'upcoming';
  if (daysPending <= 7) return 'upcoming';
  if (daysPending <= 30) return 'due_soon';
  if (daysPending <= 90) return 'overdue';
  return 'critical';
}

function statusLabel(s: PendingStatus): string {
  switch (s) {
    case 'upcoming': return 'Upcoming';
    case 'due_soon': return 'Due Soon';
    case 'overdue': return 'Overdue';
    case 'critical': return 'Critical';
  }
}

function statusClasses(s: PendingStatus): string {
  switch (s) {
    case 'upcoming': return 'bg-muted text-muted-foreground';
    case 'due_soon': return 'bg-warning/15 text-warning';
    case 'overdue': return 'bg-destructive/15 text-destructive';
    case 'critical': return 'bg-destructive text-destructive-foreground';
  }
}

interface PendingRow {
  clientId: string;
  clientName: string;
  phone: string;
  handlerCode: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceTotal: number;
  amountReceived: number;
  pendingAmount: number;
  daysPending: number;
  status: PendingStatus;
  invoiceId: string;
  clientDbId: string;
}

export default function PendingDashboard() {
  const { clients, payments, invoices, handlers, currentFY } = useERP();
  const { isAdmin, isViewer } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [handlerFilter, setHandlerFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'pending' | 'days' | 'name'>('pending');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fyClients = useMemo(() => clients.filter(c => c.financialYear === currentFY), [clients, currentFY]);
  const fyPayments = useMemo(() => payments.filter(p => p.financialYear === currentFY), [payments, currentFY]);
  const fyInvoices = useMemo(() => invoices.filter(i => i.financialYear === currentFY), [invoices, currentFY]);

  // Build pending rows from two sources: invoices and clients without invoices
  const pendingRows = useMemo(() => {
    const rows: PendingRow[] = [];

    // 1. Invoice-based pending: for each invoice, calculate received vs total
    fyInvoices.forEach(inv => {
      const clientPayments = fyPayments.filter(p => p.clientId === inv.clientId);
      const totalReceived = clientPayments.reduce((s, p) => s + p.payment, 0);
      const client = fyClients.find(c => c.clientId === inv.clientId);

      // Distribute received across invoices proportionally or use invoice total
      const invoiceReceived = Math.min(totalReceived, inv.total);
      const pending = Math.max(0, inv.total - invoiceReceived);
      const days = daysBetween(inv.date);

      if (pending > 0) {
        rows.push({
          clientId: inv.clientId,
          clientName: inv.clientName,
          phone: client?.phone || inv.clientPhone || '',
          handlerCode: inv.handlerCode,
          invoiceNo: inv.invoiceNo,
          invoiceDate: inv.date,
          invoiceTotal: inv.total,
          amountReceived: invoiceReceived,
          pendingAmount: pending,
          daysPending: days,
          status: getStatus(days, pending),
          invoiceId: inv.id,
          clientDbId: client?.id || '',
        });
      }
    });

    // 2. Client-based pending (clients with pending but no invoices)
    fyClients.forEach(client => {
      const hasInvoice = fyInvoices.some(i => i.clientId === client.clientId);
      if (!hasInvoice && client.totalPending > 0) {
        const totalDue = client.oldFeeDue + client.newFeeDue;
        const days = daysBetween(client.createdAt);
        rows.push({
          clientId: client.clientId,
          clientName: client.name,
          phone: client.phone,
          handlerCode: client.handlerCode,
          invoiceNo: '—',
          invoiceDate: client.createdAt,
          invoiceTotal: totalDue,
          amountReceived: client.totalPaidFY,
          pendingAmount: client.totalPending,
          daysPending: days,
          status: getStatus(days, client.totalPending),
          invoiceId: '',
          clientDbId: client.id,
        });
      }
    });

    return rows;
  }, [fyClients, fyPayments, fyInvoices]);

  // Filters
  const filteredRows = useMemo(() => {
    let rows = [...pendingRows];

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.clientName.toLowerCase().includes(q) ||
        r.clientId.toLowerCase().includes(q) ||
        r.invoiceNo.toLowerCase().includes(q)
      );
    }
    if (handlerFilter !== 'ALL') rows = rows.filter(r => r.handlerCode === handlerFilter);
    if (statusFilter !== 'ALL') rows = rows.filter(r => r.status === statusFilter);
    if (monthFilter !== 'ALL') {
      rows = rows.filter(r => r.invoiceDate.slice(0, 7) === monthFilter);
    }

    // Sort
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'pending') cmp = a.pendingAmount - b.pendingAmount;
      else if (sortField === 'days') cmp = a.daysPending - b.daysPending;
      else cmp = a.clientName.localeCompare(b.clientName);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return rows;
  }, [pendingRows, search, handlerFilter, statusFilter, monthFilter, sortField, sortDir]);

  // Summary stats
  const totalReceivables = pendingRows.reduce((s, r) => s + r.pendingAmount, 0);
  const totalOverdue = pendingRows.filter(r => r.status === 'overdue' || r.status === 'critical').reduce((s, r) => s + r.pendingAmount, 0);
  const pendingClientsCount = new Set(pendingRows.map(r => r.clientId)).size;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const receivedThisMonth = fyPayments.filter(p => p.date.slice(0, 7) === thisMonth).reduce((s, p) => s + p.payment, 0);

  // Unique months for filter
  const uniqueMonths = [...new Set(pendingRows.map(r => r.invoiceDate.slice(0, 7)))].sort().reverse();

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => (
    sortField === field
      ? sortDir === 'desc' ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronUp className="w-3 h-3 inline" />
      : null
  );

  // Get payment history for expanded row
  const getClientPayments = (clientId: string) => fyPayments.filter(p => p.clientId === clientId);
  const getClientInvoice = (invoiceId: string) => fyInvoices.find(i => i.id === invoiceId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="erp-page-title flex items-center gap-2">
          <IndianRupee className="w-5 h-5" /> Pending Dashboard
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Central receivables control — FY {currentFY}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Receivables"
          value={formatCurrency(totalReceivables)}
          icon={<IndianRupee className="w-4 h-4" />}
          color="erp-kpi-blue"
        />
        <SummaryCard
          label="Total Overdue"
          value={formatCurrency(totalOverdue)}
          icon={<AlertTriangle className="w-4 h-4" />}
          color="erp-kpi-red"
        />
        <SummaryCard
          label="Pending Clients"
          value={String(pendingClientsCount)}
          icon={<Users className="w-4 h-4" />}
          color="erp-kpi-amber"
        />
        <SummaryCard
          label="Received This Month"
          value={formatCurrency(receivedThisMonth)}
          icon={<TrendingUp className="w-4 h-4" />}
          color="erp-kpi-green"
        />
      </div>

      {/* Filters Bar */}
      <div className="erp-kpi-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search client, ID, invoice..."
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <FilterSelect
            label="Handler"
            value={handlerFilter}
            onChange={setHandlerFilter}
            options={[{ value: 'ALL', label: 'All Handlers' }, ...handlers.map(h => ({ value: h.code, label: `${h.code} — ${h.name}` }))]}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'ALL', label: 'All Status' },
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'due_soon', label: 'Due Soon' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
          <FilterSelect
            label="Month"
            value={monthFilter}
            onChange={setMonthFilter}
            options={[{ value: 'ALL', label: 'All Months' }, ...uniqueMonths.map(m => ({ value: m, label: m }))]}
          />

          <div className="text-[10px] text-muted-foreground ml-auto">
            {filteredRows.length} of {pendingRows.length} entries
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="erp-kpi-card p-0 overflow-auto">
        <table className="erp-table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                Client Name <SortIcon field="name" />
              </th>
              <th>Invoice #</th>
              <th className="text-right">Invoice Amount</th>
              <th className="text-right">Received</th>
              <th className="text-right cursor-pointer select-none" onClick={() => toggleSort('pending')}>
                Pending <SortIcon field="pending" />
              </th>
              <th>Date</th>
              <th className="text-right cursor-pointer select-none" onClick={() => toggleSort('days')}>
                Days <SortIcon field="days" />
              </th>
              <th>Handler</th>
              <th>Status</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-12 text-muted-foreground text-sm">
                  No pending receivables — all clear! ✓
                </td>
              </tr>
            )}
            {filteredRows.map((row, i) => (
              <React.Fragment key={`${row.clientId}-${row.invoiceId}-${i}`}>
                <tr
                  className={`cursor-pointer transition-colors ${
                    (row.status === 'critical' || row.status === 'overdue') ? 'bg-destructive/5' : ''
                  } ${expandedRow === `${row.clientId}-${i}` ? 'bg-primary/5' : ''}`}
                  onClick={() => setExpandedRow(expandedRow === `${row.clientId}-${i}` ? null : `${row.clientId}-${i}`)}
                >
                  <td className="erp-mono text-xs">{i + 1}</td>
                  <td>
                    <div className="text-xs font-medium">{row.clientName}</div>
                    <div className="text-[10px] text-muted-foreground erp-mono">{row.clientId}</div>
                  </td>
                  <td className="erp-mono text-xs">{row.invoiceNo}</td>
                  <td className="erp-mono text-xs text-right">{formatCurrency(row.invoiceTotal)}</td>
                  <td className="erp-mono text-xs text-right">{formatCurrency(row.amountReceived)}</td>
                  <td className="erp-mono text-xs text-right font-bold text-destructive">{formatCurrency(row.pendingAmount)}</td>
                  <td className="text-xs">{row.invoiceDate}</td>
                  <td className="erp-mono text-xs text-right font-medium">
                    <span className={row.daysPending > 60 ? 'text-destructive' : row.daysPending > 30 ? 'text-warning' : ''}>
                      {row.daysPending}d
                    </span>
                  </td>
                  <td className="erp-mono text-xs">{row.handlerCode}</td>
                  <td>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClasses(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      {!isViewer && (
                        <button
                          onClick={() => navigate('/payments')}
                          className="p-1 rounded hover:bg-accent/20 transition-colors"
                          title="Add Payment"
                        >
                          <Plus className="w-3.5 h-3.5 text-primary" />
                        </button>
                      )}
                      {row.invoiceId && (
                        <button
                          onClick={() => navigate('/invoice-database')}
                          className="p-1 rounded hover:bg-accent/20 transition-colors"
                          title="View Invoice"
                        >
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                      <button
                        onClick={() => navigate('/master-database')}
                        className="p-1 rounded hover:bg-accent/20 transition-colors"
                        title="Client Profile"
                      >
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded Detail Row */}
                {expandedRow === `${row.clientId}-${i}` && (
                  <tr>
                    <td colSpan={11} className="p-0">
                      <ExpandedDetail
                        row={row}
                        clientPayments={getClientPayments(row.clientId)}
                        invoice={row.invoiceId ? getClientInvoice(row.invoiceId) : undefined}
                        client={fyClients.find(c => c.clientId === row.clientId)}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Overdue Alerts */}
      {pendingRows.filter(r => r.status === 'critical').length > 0 && (
        <div className="erp-kpi-card border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-xs font-semibold text-destructive">Critical Overdue Alerts</span>
          </div>
          <div className="space-y-1">
            {pendingRows.filter(r => r.status === 'critical').slice(0, 5).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-medium">{r.clientName} <span className="text-muted-foreground erp-mono">({r.clientId})</span></span>
                <span className="erp-mono text-destructive font-bold">{formatCurrency(r.pendingAmount)} — {r.daysPending} days</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="erp-kpi-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <div className={`p-1.5 rounded-lg bg-${color}/10`}>
          {icon}
        </div>
      </div>
      <div className="text-lg font-bold erp-mono">{value}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Filter className="w-3 h-3 text-muted-foreground" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ExpandedDetail({ row, clientPayments, invoice, client }: {
  row: PendingRow;
  clientPayments: any[];
  invoice?: any;
  client?: any;
}) {
  return (
    <div className="bg-muted/30 border-t border-b border-border/50 p-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Client Info */}
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Client Details</h4>
          <div className="space-y-1 text-xs">
            <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{row.clientName}</span></div>
            <div><span className="text-muted-foreground">ID:</span> <span className="erp-mono">{row.clientId}</span></div>
            <div><span className="text-muted-foreground">Phone:</span> <span className="erp-mono">{row.phone || '—'}</span></div>
            <div><span className="text-muted-foreground">Handler:</span> <span className="erp-mono">{row.handlerCode}</span></div>
            {client && (
              <>
                <div><span className="text-muted-foreground">Old Fee Due:</span> <span className="erp-mono">{formatCurrency(client.oldFeeDue)}</span></div>
                <div><span className="text-muted-foreground">New Fee Due:</span> <span className="erp-mono">{formatCurrency(client.newFeeDue)}</span></div>
              </>
            )}
          </div>
        </div>

        {/* Invoice Info */}
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Invoice Details</h4>
          {invoice ? (
            <div className="space-y-1 text-xs">
              <div><span className="text-muted-foreground">Invoice:</span> <span className="erp-mono font-medium">{invoice.invoiceNo}</span></div>
              <div><span className="text-muted-foreground">Date:</span> {invoice.date}</div>
              <div><span className="text-muted-foreground">Subtotal:</span> <span className="erp-mono">{formatCurrency(invoice.subtotal)}</span></div>
              <div><span className="text-muted-foreground">GST:</span> <span className="erp-mono">{formatCurrency(invoice.gst)}</span></div>
              <div><span className="text-muted-foreground">Total:</span> <span className="erp-mono font-bold">{formatCurrency(invoice.total)}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <span className="capitalize">{invoice.status}</span></div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No invoice — fee-based pending</p>
          )}
        </div>

        {/* Payment History */}
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Payment History ({clientPayments.length})
          </h4>
          {clientPayments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No payments recorded</p>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {clientPayments.slice(0, 10).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-background rounded px-2 py-1">
                  <span className="text-muted-foreground">{p.date}</span>
                  <span className="erp-mono font-medium">{formatCurrency(p.payment)}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{p.paymentMode}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-border/50 flex justify-between text-xs">
            <span className="text-muted-foreground">Remaining Balance:</span>
            <span className="erp-mono font-bold text-destructive">{formatCurrency(row.pendingAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
