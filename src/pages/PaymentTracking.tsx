import React, { useState, useMemo } from 'react';
import { useERP } from '@/lib/erp-store';
import { miniDB } from '@/lib/mini-supabase';
import { useAuth } from '@/hooks/useAuth';
import { MONTHS } from '@/lib/erp-types';
import { IndianRupee, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { playSuccess } from '@/lib/sound-engine';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from '@/components/ui/dialog';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

const CASH_DENOMINATIONS = [
  { label: '₹500', value: 500 },
  { label: '₹200', value: 200 },
  { label: '₹100', value: 100 },
  { label: '₹50', value: 50 },
  { label: '₹20', value: 20 },
  { label: '₹10', value: 10 },
];
function generatePaymentId() {
  return "PAY-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export default function PaymentTracking() {
  const { payments, clients, handlers, currentFY, addPayment, removePayment, restorePayment } = useERP();
  const { isViewer, isAdmin } = useAuth();
  const { toast } = useToast();
  const fyPayments = payments.filter(p => p.financialYear === currentFY);
  const fyClients = clients.filter(c => c.financialYear === currentFY);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletedPayments, setDeletedPayments] = useState<any[]>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    clientId: '', handlerCode: handlers[0]?.code || 'K-A-H-001',
    paidTermFrom: 'April', paidTermTo: 'April', dueAmount: 0, payment: 0,
    paymentMode: 'cash',
    reason: '', remarks: '',
    // UPI fields
    upiAmount: 0, utrNumber: '', upiApp: '',
    // Bank fields
    bankAmount: 0, bankReference: '', bankName: '',
    // Fee adjustment
    adjustmentAmount: 0,
  });

  // Cash note counter
  const [cashNotes, setCashNotes] = useState<Record<number, number>>({
    500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0,
  });

  const cashTotal = useMemo(() =>
    Object.entries(cashNotes).reduce((s, [denom, count]) => s + Number(denom) * count, 0),
  [cashNotes]);

  const selectedClient = fyClients.find(c => c.clientId === form.clientId);

  // Auto-fill client data
  React.useEffect(() => {
    if (selectedClient) {
      setForm(f => ({
        ...f,
        handlerCode: selectedClient.handlerCode,
        dueAmount: selectedClient.totalPending + (selectedClient.newFee || selectedClient.oldFee),
      }));
    }
  }, [selectedClient]);

  // Calculate total payment based on mode
  const computedPayment = useMemo(() => {
    switch (form.paymentMode) {
      case 'cash': return cashTotal;
      case 'upi': return form.upiAmount;
      case 'bank': return form.bankAmount;
      case 'adjustment': return form.adjustmentAmount;
      default: return form.payment;
    }
  }, [form.paymentMode, cashTotal, form.upiAmount, form.bankAmount, form.adjustmentAmount, form.payment]);
const handleAdd = async () => {
  if (!selectedClient) return;

  // Validation
  if (form.paymentMode === 'upi' && !form.utrNumber.trim()) {
    toast({ title: 'UTR Number required', description: 'UPI payments require a UTR number', variant: 'destructive' });
    return;
  }

  if (form.paymentMode === 'bank' && !form.bankReference.trim()) {
    toast({ title: 'Reference required', description: 'Bank transfers require a reference number', variant: 'destructive' });
    return;
  }
setSaving(true);
try {

  const paymentId = generatePaymentId();

  const cashNotesStr = form.paymentMode === 'cash'
      ? Object.entries(cashNotes)
          .filter(([, c]) => c > 0)
          .map(([d, c]) => `₹${d}×${c}`)
          .join(', ')
      : '';

    await addPayment({
      id: paymentId,
      ...form,
      payment: computedPayment,
      dueAmount: form.dueAmount,
      financialYear: currentFY,
      clientName: selectedClient.name,
      handlerCode: selectedClient.handlerCode,
      oldFee: selectedClient.oldFee,
      newFee: selectedClient.newFee,
    });
playSuccess();
      // Reset
      setForm({
        date: new Date().toISOString().split('T')[0], clientId: '', handlerCode: handlers[0]?.code || 'K-A-H-001',
        paidTermFrom: 'April', paidTermTo: 'April', dueAmount: 0, payment: 0, paymentMode: 'cash',
        reason: '', remarks: '', upiAmount: 0, utrNumber: '', upiApp: '',
        bankAmount: 0, bankReference: '', bankName: '', adjustmentAmount: 0,
      });
      setCashNotes({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 });
      setOpen(false);
      toast({ title: 'Payment recorded successfully' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const loadDeletedPayments = async () => {
    if (!isAdmin) return;
    const { data } = await miniDB.from('payments').select('*').eq('deleted', true);
    setDeletedPayments(data || []);
  };

  const handleRestore = async (id: string) => {
    await restorePayment(id);
    await loadDeletedPayments();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await removePayment(deleteId);
      toast({ title: 'Payment deleted successfully' });
      setDeleteId(null);
      await loadDeletedPayments();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  React.useEffect(() => { loadDeletedPayments(); }, [isAdmin]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><IndianRupee className="w-5 h-5" /> Payment Tracking</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{fyPayments.length} Entries — FY {currentFY}</p>
        </div>
        {!isViewer && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="w-3.5 h-3.5" /> Record Payment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Client</label>
                <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                  <option value="">— Select Client —</option>
                  {fyClients.map(c => <option key={c.clientId} value={c.clientId}>{c.clientId} — {c.name}</option>)}
                </select>
              </div>

              {/* Auto-filled client info */}
              {selectedClient && (
                <div className="p-3 bg-muted/50 rounded-sm space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Client Name</span><span className="font-medium">{selectedClient.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Client ID</span><span className="erp-mono">{selectedClient.clientId}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Handler</span><span className="erp-mono">{selectedClient.handlerCode}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Previous Due</span><span className="erp-mono font-bold">{formatCurrency(selectedClient.totalPending)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Monthly Fee</span><span className="erp-mono">{formatCurrency(selectedClient.newFee || selectedClient.oldFee)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">Total Payable</span><span className="erp-mono font-bold text-destructive">{formatCurrency(form.dueAmount)}</span></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Paid Term From</label>
                  <select value={form.paidTermFrom} onChange={e => setForm({ ...form, paidTermFrom: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Paid Term To</label>
                  <select value={form.paidTermTo} onChange={e => setForm({ ...form, paidTermTo: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="text-xs text-muted-foreground">Payment Mode</label>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {['cash', 'upi', 'bank', 'adjustment'].map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setForm({ ...form, paymentMode: mode })}
                      className={`px-3 py-2 text-xs font-medium rounded-sm border transition-colors ${form.paymentMode === mode ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                    >
                      {mode.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Note Counter */}
              {form.paymentMode === 'cash' && (
                <div className="p-3 border rounded-sm space-y-2">
                  <p className="text-xs font-semibold">Cash Note Counter</p>
                  {CASH_DENOMINATIONS.map(d => (
                    <div key={d.value} className="flex items-center gap-2">
                      <span className="w-12 text-xs erp-mono font-medium">{d.label}</span>
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        type="number"
                        min={0}
                        value={cashNotes[d.value]}
                        onChange={e => setCashNotes({ ...cashNotes, [d.value]: Math.max(0, +e.target.value) })}
                        className="w-20 h-8 text-center erp-mono"
                      />
                      <span className="text-xs text-muted-foreground">=</span>
                      <span className="erp-mono text-xs font-bold w-20 text-right">{formatCurrency(d.value * cashNotes[d.value])}</span>
                    </div>
                  ))}, 

                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-xs font-semibold">Total Cash</span>
                    <span className="erp-mono text-sm font-bold text-[hsl(var(--success))]">{formatCurrency(cashTotal)}</span>
                  </div>
                </div>
              )}

              {/* UPI Fields */}
              {form.paymentMode === 'upi' && (
                <div className="p-3 border rounded-sm space-y-2">
                  <p className="text-xs font-semibold">UPI Payment Details</p>
                  <div>
                    <label className="text-xs text-muted-foreground">UPI Amount *</label>
                    <Input type="number" value={form.upiAmount} onChange={e => setForm({ ...form, upiAmount: +e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">UTR Number * (mandatory)</label>
                    <Input value={form.utrNumber} onChange={e => setForm({ ...form, utrNumber: e.target.value })} placeholder="Enter UTR number" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">UPI App (optional)</label>
                    <Input value={form.upiApp} onChange={e => setForm({ ...form, upiApp: e.target.value })} placeholder="e.g. GPay, PhonePe" />
                  </div>
                </div>
              )}

              {/* Bank Transfer */}
              {form.paymentMode === 'bank' && (
                <div className="p-3 border rounded-sm space-y-2">
                  <p className="text-xs font-semibold">Bank Transfer Details</p>
                  <div>
                    <label className="text-xs text-muted-foreground">Amount *</label>
                    <Input type="number" value={form.bankAmount} onChange={e => setForm({ ...form, bankAmount: +e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Reference Number *</label>
                    <Input value={form.bankReference} onChange={e => setForm({ ...form, bankReference: e.target.value })} placeholder="Transaction reference" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Bank Name</label>
                    <Input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. SBI, HDFC" />
                  </div>
                </div>
              )}

              {/* Fee Adjustment */}
              {form.paymentMode === 'adjustment' && (
                <div className="p-3 border rounded-sm space-y-2">
                  <p className="text-xs font-semibold">Fee Adjustment</p>
                  <div>
                    <label className="text-xs text-muted-foreground">Adjustment Amount</label>
                    <Input type="number" value={form.adjustmentAmount} onChange={e => setForm({ ...form, adjustmentAmount: +e.target.value })} />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground">Reason</label>
                <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Remarks</label>
                <Input value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
              </div>

              {/* Summary */}
              <div className="p-3 bg-muted rounded-sm space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Payment Amount</span><span className="erp-mono font-bold text-[hsl(var(--success))]">{formatCurrency(computedPayment)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Due Amount</span><span className="erp-mono">{formatCurrency(form.dueAmount)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="font-semibold">Pending After Payment</span>
                  <span className="erp-mono font-bold text-destructive">{formatCurrency(Math.max(0, form.dueAmount - computedPayment))}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAdd} disabled={!selectedClient || saving || computedPayment <= 0}>{saving ? 'Saving...' : 'Record Payment'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="erp-kpi-card p-0 overflow-auto">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Client ID</th>
              <th>Client Name</th>
              <th>Handler</th>
              <th>Paid From</th>
              <th>Paid To</th>
              <th className="text-right">Due Amt</th>
              <th className="text-right">Payment</th>
              <th className="text-right">Pending</th>
              <th>Mode</th>
              <th>Remarks</th>
              {!isViewer && <th></th>}
            </tr>
          </thead>
          <tbody>
            {fyPayments.length === 0 && (
              <tr><td colSpan={isViewer ? 11 : 12} className="text-center py-8 text-muted-foreground text-sm">No payments recorded yet.</td></tr>
            )}
            {fyPayments.map(p => (
              <tr key={p.id}>
                <td className="erp-mono text-xs">{p.id}</td>
                <td className="erp-mono text-xs">{p.date}</td>
                <td className="erp-mono text-xs">{p.clientId}</td>
                <td className="text-xs font-medium">{p.clientName}</td>
                <td className="erp-mono text-xs">{p.handlerCode}</td>
                <td className="text-xs">{p.paidTermFrom || '—'}</td>
                <td className="text-xs">{p.paidTermTo || '—'}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(p.dueAmount)}</td>
                <td className="erp-mono text-xs text-right font-bold text-[hsl(var(--success))]">{formatCurrency(p.payment)}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(p.pending)}</td>
                <td><span className="erp-badge erp-badge-info text-[10px]">{(p.paymentMode || 'cash').toUpperCase()}</span></td>
                <td className="text-xs">{p.remarks}</td>
                {!isViewer && (
                  <td>
                    <button onClick={() => setDeleteId(p.id)} className="erp-btn-danger-icon">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && deletedPayments.length > 0 && (
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">Deleted Payments</h3>
          <div className="space-y-1">
            {deletedPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="erp-mono">{p.client_id} — {p.payment_mode || 'cash'} — ₹{Number(p.payment || 0).toLocaleString('en-IN')}</span>
                <Button size="sm" variant="outline" onClick={() => handleRestore(p.id)}>Restore</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={(next) => !next && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete payment entry?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button className="erp-btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
