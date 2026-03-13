import React, { useState, useMemo } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import {
  Search, X, Users, IndianRupee, Clock, TrendingUp, AlertTriangle,
  ChevronDown, ChevronUp, Eye
} from 'lucide-react';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

interface ClientProfile {
  id: string;
  clientId: string;
  name: string;
  handlerCode: string;
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
  paymentCount: number;
  avgPaymentDelay: number;
  lastPaymentDate: string;
  invoiceCount: number;
  status: 'excellent' | 'good' | 'average' | 'poor';
}

function getClientGrade(avgDelay: number, pending: number, revenue: number): 'excellent' | 'good' | 'average' | 'poor' {
  if (pending === 0 && avgDelay <= 7) return 'excellent';
  if (avgDelay <= 30 && pending < revenue * 0.3) return 'good';
  if (avgDelay <= 60) return 'average';
  return 'poor';
}

function gradeClasses(s: string): string {
  switch (s) {
    case 'excellent': return 'bg-success/15 text-success';
    case 'good': return 'bg-info/15 text-info';
    case 'average': return 'bg-warning/15 text-warning';
    case 'poor': return 'bg-destructive/15 text-destructive';
    default: return 'bg-muted text-muted-foreground';
  }
}

export default function ClientIntelligence() {
  const { clients, payments, invoices, handlers, currentFY } = useERP();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [handlerFilter, setHandlerFilter] = useState('ALL');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'revenue' | 'pending' | 'delay' | 'name'>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const fyClients = useMemo(() => clients.filter(c => c.financialYear === currentFY), [clients, currentFY]);
  const fyPayments = useMemo(() => payments.filter(p => p.financialYear === currentFY), [payments, currentFY]);
  const fyInvoices = useMemo(() => invoices.filter(i => i.financialYear === currentFY), [invoices, currentFY]);

  const profiles = useMemo<ClientProfile[]>(() => {
    return fyClients.map(client => {
      const cPayments = fyPayments.filter(p => p.clientId === client.clientId);
      const cInvoices = fyInvoices.filter(i => i.clientId === client.clientId);
      const totalRevenue = client.oldFeeDue + client.newFeeDue;
      const totalPaid = client.totalPaidFY;

      // Calculate average payment delay
      const delays = cPayments.map(p => {
        const pDate = new Date(p.date);
        const clientCreated = new Date(client.createdAt);
        return Math.max(0, Math.floor((pDate.getTime() - clientCreated.getTime()) / 86400000));
      });
      const avgDelay = delays.length > 0 ? Math.round(delays.reduce((s, d) => s + d, 0) / delays.length) : 0;

      const lastPayment = cPayments.length > 0
        ? cPayments.sort((a, b) => b.date.localeCompare(a.date))[0].date
        : '—';

      return {
        id: client.id,
        clientId: client.clientId,
        name: client.name,
        handlerCode: client.handlerCode,
        totalRevenue,
        totalPaid,
        totalPending: client.totalPending,
        paymentCount: cPayments.length,
        avgPaymentDelay: avgDelay,
        lastPaymentDate: lastPayment,
        invoiceCount: cInvoices.length,
        status: getClientGrade(avgDelay, client.totalPending, totalRevenue),
      };
    });
  }, [fyClients, fyPayments, fyInvoices]);

  const filtered = useMemo(() => {
    let rows = [...profiles];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.clientId.toLowerCase().includes(q));
    }
    if (handlerFilter !== 'ALL') rows = rows.filter(r => r.handlerCode === handlerFilter);
    if (gradeFilter !== 'ALL') rows = rows.filter(r => r.status === gradeFilter);

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'revenue') cmp = a.totalRevenue - b.totalRevenue;
      else if (sortField === 'pending') cmp = a.totalPending - b.totalPending;
      else if (sortField === 'delay') cmp = a.avgPaymentDelay - b.avgPaymentDelay;
      else cmp = a.name.localeCompare(b.name);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return rows;
  }, [profiles, search, handlerFilter, gradeFilter, sortField, sortDir]);

  // Summary
  const excellent = profiles.filter(p => p.status === 'excellent').length;
  const good = profiles.filter(p => p.status === 'good').length;
  const average = profiles.filter(p => p.status === 'average').length;
  const poor = profiles.filter(p => p.status === 'poor').length;
  const totalRevenue = profiles.reduce((s, p) => s + p.totalRevenue, 0);
  const totalPending = profiles.reduce((s, p) => s + p.totalPending, 0);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => (
    sortField === field
      ? sortDir === 'desc' ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronUp className="w-3 h-3 inline" />
      : null
  );

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Admin access required for Client Intelligence.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="erp-page-title flex items-center gap-2"><Eye className="w-5 h-5" /> Client Intelligence</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Per-client analytics, payment behavior & risk profiling — FY {currentFY}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="erp-kpi-card flex items-start gap-3">
          <div className="kpi-icon-box bg-info/10"><Users className="w-4 h-4 text-info" /></div>
          <div><p className="text-[11px] text-muted-foreground">Total Clients</p><p className="kpi-value erp-mono">{profiles.length}</p></div>
        </div>
        <div className="erp-kpi-card flex items-start gap-3">
          <div className="kpi-icon-box bg-success/10"><IndianRupee className="w-4 h-4 text-success" /></div>
          <div><p className="text-[11px] text-muted-foreground">Total Revenue</p><p className="kpi-value erp-mono">{formatCurrency(totalRevenue)}</p></div>
        </div>
        <div className="erp-kpi-card flex items-start gap-3">
          <div className="kpi-icon-box bg-destructive/10"><AlertTriangle className="w-4 h-4 text-destructive" /></div>
          <div><p className="text-[11px] text-muted-foreground">Total Pending</p><p className="kpi-value erp-mono">{formatCurrency(totalPending)}</p></div>
        </div>
        <div className="erp-kpi-card flex items-start gap-3">
          <div className="kpi-icon-box bg-warning/10"><Clock className="w-4 h-4 text-warning" /></div>
          <div><p className="text-[11px] text-muted-foreground">At-Risk Clients</p><p className="kpi-value erp-mono">{poor}</p></div>
        </div>
      </div>

      {/* Grade Distribution */}
      <div className="erp-kpi-card">
        <h3 className="text-sm font-semibold mb-3">Client Grade Distribution</h3>
        <div className="flex items-center gap-4">
          {[
            { label: 'Excellent', count: excellent, color: 'bg-success' },
            { label: 'Good', count: good, color: 'bg-info' },
            { label: 'Average', count: average, color: 'bg-warning' },
            { label: 'Poor', count: poor, color: 'bg-destructive' },
          ].map(g => (
            <div key={g.label} className="flex items-center gap-2 text-xs">
              <div className={`w-3 h-3 rounded-full ${g.color}`} />
              <span className="text-muted-foreground">{g.label}:</span>
              <span className="font-bold erp-mono">{g.count}</span>
            </div>
          ))}
        </div>
        {profiles.length > 0 && (
          <div className="flex h-2.5 rounded-full overflow-hidden mt-3">
            {excellent > 0 && <div className="bg-success" style={{ width: `${(excellent / profiles.length) * 100}%` }} />}
            {good > 0 && <div className="bg-info" style={{ width: `${(good / profiles.length) * 100}%` }} />}
            {average > 0 && <div className="bg-warning" style={{ width: `${(average / profiles.length) * 100}%` }} />}
            {poor > 0 && <div className="bg-destructive" style={{ width: `${(poor / profiles.length) * 100}%` }} />}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="erp-kpi-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client..."
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
          </div>
          <select value={handlerFilter} onChange={e => setHandlerFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="ALL">All Handlers</option>
            {handlers.map(h => <option key={h.code} value={h.code}>{h.code} — {h.name}</option>)}
          </select>
          <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="ALL">All Grades</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="average">Average</option>
            <option value="poor">Poor</option>
          </select>
          <div className="text-[10px] text-muted-foreground ml-auto">{filtered.length} clients</div>
        </div>
      </div>

      {/* Client Table */}
      <div className="erp-kpi-card p-0 overflow-auto">
        <table className="erp-table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th className="cursor-pointer select-none" onClick={() => toggleSort('name')}>Client <SortIcon field="name" /></th>
              <th>Handler</th>
              <th className="text-right cursor-pointer select-none" onClick={() => toggleSort('revenue')}>Total Revenue <SortIcon field="revenue" /></th>
              <th className="text-right">Paid</th>
              <th className="text-right cursor-pointer select-none" onClick={() => toggleSort('pending')}>Pending <SortIcon field="pending" /></th>
              <th className="text-center">Payments</th>
              <th className="text-right cursor-pointer select-none" onClick={() => toggleSort('delay')}>Avg Delay <SortIcon field="delay" /></th>
              <th>Last Payment</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">No client data found.</td></tr>
            )}
            {filtered.map((c, i) => (
              <React.Fragment key={c.id}>
                <tr
                  className={`cursor-pointer transition-colors ${expandedClient === c.id ? 'bg-primary/5' : ''}`}
                  onClick={() => setExpandedClient(expandedClient === c.id ? null : c.id)}
                >
                  <td className="erp-mono text-xs">{i + 1}</td>
                  <td>
                    <div className="text-xs font-medium">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground erp-mono">{c.clientId}</div>
                  </td>
                  <td className="erp-mono text-xs">{c.handlerCode}</td>
                  <td className="erp-mono text-xs text-right font-semibold">{formatCurrency(c.totalRevenue)}</td>
                  <td className="erp-mono text-xs text-right text-success">{formatCurrency(c.totalPaid)}</td>
                  <td className="erp-mono text-xs text-right text-destructive font-bold">{formatCurrency(c.totalPending)}</td>
                  <td className="erp-mono text-xs text-center">{c.paymentCount}</td>
                  <td className="erp-mono text-xs text-right">
                    <span className={c.avgPaymentDelay > 60 ? 'text-destructive' : c.avgPaymentDelay > 30 ? 'text-warning' : ''}>{c.avgPaymentDelay}d</span>
                  </td>
                  <td className="erp-mono text-xs">{c.lastPaymentDate}</td>
                  <td>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${gradeClasses(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
                {expandedClient === c.id && (
                  <tr>
                    <td colSpan={10} className="p-0">
                      <ClientDetail clientId={c.clientId} payments={fyPayments} invoices={fyInvoices} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientDetail({ clientId, payments, invoices }: { clientId: string; payments: any[]; invoices: any[] }) {
  const cPayments = payments.filter(p => p.clientId === clientId).sort((a: any, b: any) => b.date.localeCompare(a.date));
  const cInvoices = invoices.filter(i => i.clientId === clientId);

  return (
    <div className="bg-muted/30 border-t p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Payment History */}
        <div>
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Payment History ({cPayments.length})</h4>
          {cPayments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No payments recorded.</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {cPayments.slice(0, 10).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-xs bg-background rounded px-2 py-1.5">
                  <span className="erp-mono text-muted-foreground">{p.date}</span>
                  <span className="erp-mono font-medium text-success">{formatCurrency(p.payment)}</span>
                  <span className="text-muted-foreground">{p.paymentMode || 'cash'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoices */}
        <div>
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Invoices ({cInvoices.length})</h4>
          {cInvoices.length === 0 ? (
            <p className="text-xs text-muted-foreground">No invoices found.</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {cInvoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between text-xs bg-background rounded px-2 py-1.5">
                  <span className="erp-mono">{inv.invoiceNo}</span>
                  <span className="erp-mono font-medium">{formatCurrency(inv.total)}</span>
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${inv.status === 'paid' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                    {inv.status || 'pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
