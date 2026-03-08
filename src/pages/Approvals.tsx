import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useERP } from '@/lib/erp-store';
import { miniDB } from '@/lib/mini-supabase';
import { loadDB, saveDB, genId } from '@/lib/mini-supabase/mini-db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { playApproved, playError, playClick } from "@/lib/sound-engine";
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, ArrowRight, ShieldCheck, Clock, FileText } from 'lucide-react';

type RecordStatus = 'draft' | 'uploaded' | 'pending_approval' | 'approved' | 'posted' | 'locked' | 'rejected';

function statusBadge(status: RecordStatus) {
  const cls: Record<string, string> = {
    draft: 'status-draft', uploaded: 'status-uploaded', pending_approval: 'status-pending',
    approved: 'status-approved', posted: 'status-posted', locked: 'status-locked', rejected: 'status-rejected',
  };
  return <Badge variant="outline" className={`status-badge ${cls[status] || ''}`}>{status.replace(/_/g, ' ').toUpperCase()}</Badge>;
}

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function Approvals() {
  const { user, isAdmin } = useAuth();
  const { payments, clients, invoices, currentFY, refreshData, addInvoice } = useERP();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectReason, setRejectReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [processing, setProcessing] = useState(false);

  const records = useMemo(() => {
    const fyPayments = payments.filter(p => p.financialYear === currentFY);
    return fyPayments.map(p => ({
      id: p.id,
      client_id: p.clientId,
      client_name: p.clientName,
      handler_code: p.handlerCode,
      month: p.paidTermFrom,
      month_to: p.paidTermTo,
      invoice_amount: p.dueAmount,
      payment_received: p.payment,
      current_due: p.pending || 0,
      payment_mode: p.paymentMode || 'cash',
      risk_score: p.payment < p.dueAmount * 0.5 ? 8 : p.payment < p.dueAmount * 0.8 ? 5 : 2,
      status: ((p as any).approvalStatus || (p as any).approval_status || 'pending_approval') as RecordStatus,
      date: p.date,
    }));
  }, [payments, currentFY]);

  const filtered = useMemo(() => {

  // hide approved records automatically
  const base = records.filter(r => r.status !== 'approved');

  if (statusFilter === 'all') return base;

  return base.filter(r => r.status === statusFilter);

  }, [records, statusFilter]);
  const pendingCount = records.filter(r => r.status === 'pending_approval').length;
  const approvedCount = records.filter(r => r.status === 'approved').length;
  const postedCount = records.filter(r => r.status === 'posted').length;
  const rejectedCount = records.filter(r => r.status === 'rejected').length;

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(r => r.id)));
  };

  const updatePaymentStatus = async (paymentId: string, newStatus: RecordStatus, reason?: string) => {
    const db = await loadDB();
    const payment = db.payments.find((p: any) => p.id === paymentId && !p.deleted);
    if (!payment) return;

    payment.approval_status = newStatus;
    payment.approved_by = user?.email || '';
    payment.approval_timestamp = new Date().toISOString();
    if (reason) payment.rejection_reason = reason;

    db.audit_logs.push({
      id: genId(),
      user_id: user?.id || '',
      user_email: user?.email || '',
      role: 'admin',
      action: newStatus === 'approved' ? 'approve' : newStatus === 'rejected' ? 'reject' : 'post',
      module: 'approvals',
      record_id: paymentId,
      ip_address: 'local',
      timestamp: new Date().toISOString(),
    });

    // If posting: update client dues + generate invoice
    if (newStatus === 'posted') {
      const client = db.clients.find((c: any) => c.client_id === payment.client_id && !c.deleted);
      if (client) {
        client.total_paid_fy = (Number(client.total_paid_fy) || 0) + Number(payment.payment);
        client.total_pending = Math.max(0,
          (Number(client.old_fee_due) || 0) + (Number(client.new_fee_due) || 0) - client.total_paid_fy
        );
        client.updated_at = new Date().toISOString();
      }
    }

    await saveDB(db);
  };

  const handleApprove = async (id: string) => {
    setProcessing(true);
    try {
      await updatePaymentStatus(id, 'approved');
      await refreshData();
      toast({ title: 'Approved', description: `Payment approved successfully` });
      setSelected(s => { const n = new Set(s); n.delete(id); return n; });
    } finally {
      setProcessing(false);
    }
    playApproved();
    toast({ title: 'Approved', description: `Payment approved successfully` });
  };

  const handleReject = async (id: string, reason?: string) => {
    setProcessing(true);
    try {
      await updatePaymentStatus(id, 'rejected', reason || 'Rejected by admin');
      await refreshData();
      toast({ title: 'Rejected', description: `Payment rejected` });
      setSelected(s => { const n = new Set(s); n.delete(id); return n; });
    } finally {
      setProcessing(false);
    }
  };

  const handlePost = async (id: string) => {
    setProcessing(true);
    try {
      const record = records.find(r => r.id === id);
      await updatePaymentStatus(id, 'posted');

      // Auto-generate invoice after posting
      if (record) {
        try {
          await addInvoice({
            invoiceNo: '',
            date: record.date || new Date().toISOString().split('T')[0],
            clientId: record.client_id,
            clientName: record.client_name,
            clientPhone: '',
            handlerCode: record.handler_code,
            items: [{
              description: `Professional Services (${record.month}${record.month_to && record.month_to !== record.month ? ' – ' + record.month_to : ''})`,
              amount: record.payment_received,
            }],
            subtotal: record.payment_received,
            gst: 0,
            total: record.payment_received,
            financialYear: currentFY,
            status: 'paid',
          });
        } catch {
          // Invoice generation is best-effort
        }
      }

      await refreshData();
      toast({ title: 'Posted', description: `Payment posted to ledger and invoice generated` });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    setProcessing(true);
    try {
      for (const id of selected) {
        await updatePaymentStatus(id, 'approved');
      }
      await refreshData();
      toast({ title: 'Bulk Approved', description: `${selected.size} records approved` });
      setSelected(new Set());
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: 'Enter rejection reason', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      for (const id of selected) {
        await updatePaymentStatus(id, 'rejected', rejectReason);
      }
      await refreshData();
      toast({ title: 'Bulk Rejected', description: `${selected.size} records rejected` });
      setSelected(new Set());
      setRejectReason('');
    } finally {
      setProcessing(false);
    }
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Admin access required</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Approvals — Maker–Checker</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} records — FY {currentFY}</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <div className="erp-kpi-card text-center">
          <div className="flex items-center justify-center gap-1 mb-1"><Clock className="w-3.5 h-3.5 text-[hsl(var(--warning))]" /></div>
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-xl font-bold erp-mono text-[hsl(var(--warning))]">{pendingCount}</p>
        </div>
        <div className="erp-kpi-card text-center">
          <div className="flex items-center justify-center gap-1 mb-1"><CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--success))]" /></div>
          <p className="text-xs text-muted-foreground">Approved</p>
          <p className="text-xl font-bold erp-mono text-[hsl(var(--success))]">{approvedCount}</p>
        </div>
        <div className="erp-kpi-card text-center">
          <div className="flex items-center justify-center gap-1 mb-1"><FileText className="w-3.5 h-3.5 text-[hsl(var(--info))]" /></div>
          <p className="text-xs text-muted-foreground">Posted</p>
          <p className="text-xl font-bold erp-mono text-[hsl(var(--info))]">{postedCount}</p>
        </div>
        <div className="erp-kpi-card text-center">
          <div className="flex items-center justify-center gap-1 mb-1"><XCircle className="w-3.5 h-3.5 text-destructive" /></div>
          <p className="text-xs text-muted-foreground">Rejected</p>
          <p className="text-xl font-bold erp-mono text-destructive">{rejectedCount}</p>
        </div>
      </div>

      {selected.size > 0 && (
        <Card className="border-primary/40">
          <CardContent className="py-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button size="sm" onClick={handleBulkApprove} disabled={processing}>
              <CheckCircle className="w-3 h-3 mr-1" /> Approve All
            </Button>
            <Input className="w-48" placeholder="Rejection reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <Button size="sm" variant="destructive" onClick={handleBulkReject} disabled={processing}>
              <XCircle className="w-3 h-3 mr-1" /> Reject All
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Handler</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-right">Payment</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id} className={r.risk_score > 6 ? 'bg-destructive/5' : ''}>
                  <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} /></TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{r.client_name}</p>
                    <p className="text-[10px] erp-mono text-muted-foreground">{r.client_id}</p>
                  </TableCell>
                  <TableCell className="text-sm erp-mono">{r.handler_code}</TableCell>
                  <TableCell className="text-sm">{r.month}{r.month_to && r.month_to !== r.month ? ` – ${r.month_to}` : ''}</TableCell>
                  <TableCell><span className="erp-badge erp-badge-info text-[10px]">{r.payment_mode.toUpperCase()}</span></TableCell>
                  <TableCell className="erp-mono text-right">{formatCurrency(r.invoice_amount)}</TableCell>
                  <TableCell className="erp-mono text-right font-bold text-[hsl(var(--success))]">{formatCurrency(r.payment_received)}</TableCell>
                  <TableCell className={`erp-mono text-right ${r.current_due > 0 ? 'text-destructive font-medium' : ''}`}>{formatCurrency(r.current_due)}</TableCell>
                  <TableCell>
                    <Badge variant={r.risk_score > 6 ? 'destructive' : 'secondary'} className="text-xs">
                      {r.risk_score > 6 ? 'High' : r.risk_score > 4 ? 'Med' : 'Low'}
                    </Badge>
                  </TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.status === 'pending_approval' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => handleApprove(r.id)} disabled={processing} title="Approve">
                            <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleReject(r.id)} disabled={processing} title="Reject">
                            <XCircle className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <Button size="sm" variant="ghost" onClick={() => handlePost(r.id)} disabled={processing} title="Post to Ledger">
                          <ArrowRight className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No records found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
