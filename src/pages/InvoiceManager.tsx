import React, { useState, useRef } from 'react';
import { useERP } from '@/lib/erp-store';
import { FileText, Plus, Printer, Trash2, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { MONTHS } from '@/lib/erp-types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function InvoiceManager() {
  const { invoices, clients, payments, currentFY, addInvoice, removeInvoice } = useERP();
  const { isViewer } = useAuth();
  const { toast } = useToast();
  const fyInvoices = invoices.filter(i => i.financialYear === currentFY);
  const fyClients = clients.filter(c => c.financialYear === currentFY);
  const fyPayments = payments.filter(p => p.financialYear === currentFY);
  const [open, setOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    invoiceNo: '', date: new Date().toISOString().split('T')[0],
    clientId: '', description: 'Professional Services', amount: 0,
    servicePeriodFrom: 'April', servicePeriodTo: 'March',
  });

  const selectedClient = fyClients.find(c => c.clientId === form.clientId);

  // Auto-fill amount from client data
  React.useEffect(() => {
    if (selectedClient) {
      const clientPayments = fyPayments.filter(p => p.clientId === selectedClient.clientId);
      const lastPayment = clientPayments.sort((a, b) => b.date.localeCompare(a.date))[0];
      setForm(f => ({
        ...f,
        amount: lastPayment?.payment || selectedClient.newFee || selectedClient.oldFee,
      }));
    }
  }, [selectedClient]);

  const handleGenerate = async () => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      const subtotal = form.amount;
      await addInvoice({
        invoiceNo: form.invoiceNo,
        date: form.date,
        clientId: selectedClient.clientId,
        clientName: selectedClient.name,
        clientPhone: selectedClient.phone,
        handlerCode: selectedClient.handlerCode,
        items: [{ description: `${form.description} (${form.servicePeriodFrom} – ${form.servicePeriodTo})`, amount: form.amount }],
        subtotal,
        gst: 0,
        total: subtotal,
        financialYear: currentFY,
        status: 'pending',
      });
      setForm({ invoiceNo: '', date: new Date().toISOString().split('T')[0], clientId: '', description: 'Professional Services', amount: 0, servicePeriodFrom: 'April', servicePeriodTo: 'March' });
      setOpen(false);
      toast({ title: 'Invoice generated successfully' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const viewedInvoice = fyInvoices.find(i => i.id === previewInvoice);

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Invoice</title><style>body{font-family:system-ui,sans-serif;padding:40px;font-size:14px;color:#1a1a2e}table{width:100%;border-collapse:collapse}th,td{padding:10px 14px;border:1px solid #e0e0e0;text-align:left}.right{text-align:right}.mono{font-family:'JetBrains Mono',monospace}.header{display:flex;justify-content:space-between;margin-bottom:30px;align-items:flex-start}.total-row{font-weight:bold;background:#f8fafc}.firm-name{font-size:20px;font-weight:800;color:#0c4a6e}.subtitle{font-size:11px;color:#64748b}hr{border:none;border-top:2px solid #0c4a6e;margin:16px 0}.bill-to{background:#f8fafc;padding:12px;border-radius:4px;margin-bottom:16px}.footer{margin-top:30px;text-align:center;color:#94a3b8;font-size:10px}</style></head><body>${printRef.current.innerHTML}<div class="footer">This is a computer-generated invoice. No signature required.</div></body></html>`);
    w.document.close();
    w.print();
  };

  const handleWhatsApp = () => {
    if (!viewedInvoice) return;
    const text = `Invoice ${viewedInvoice.invoiceNo}\nClient: ${viewedInvoice.clientName}\nAmount: ${formatCurrency(viewedInvoice.total)}\nDate: ${viewedInvoice.date}\nThank you for your payment.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleEmail = () => {
    if (!viewedInvoice) return;
    const subject = `Invoice ${viewedInvoice.invoiceNo} — Kota Associates`;
    const body = `Dear ${viewedInvoice.clientName},\n\nPlease find your invoice details below:\n\nInvoice No: ${viewedInvoice.invoiceNo}\nDate: ${viewedInvoice.date}\nAmount: ${formatCurrency(viewedInvoice.total)}\n\nThank you for your business.\n\nRegards,\nKota Associates`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await removeInvoice(deleteId);
      toast({ title: 'Invoice deleted successfully' });
      if (previewInvoice === deleteId) setPreviewInvoice(null);
      setDeleteId(null);
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><FileText className="w-5 h-5" /> Invoice Manager</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{fyInvoices.length} Invoices — FY {currentFY} — No GST</p>
        </div>
        {!isViewer && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="w-3.5 h-3.5" /> Generate Invoice</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Generate Professional Invoice</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Invoice No</label>
                    <Input value={form.invoiceNo} onChange={e => setForm({ ...form, invoiceNo: e.target.value })} placeholder="Auto-generated" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Date</label>
                    <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Client</label>
                  <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                    <option value="">— Select Client —</option>
                    {fyClients.map(c => <option key={c.clientId} value={c.clientId}>{c.clientId} — {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Service Description</label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Period From</label>
                    <select value={form.servicePeriodFrom} onChange={e => setForm({ ...form, servicePeriodFrom: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Period To</label>
                    <select value={form.servicePeriodTo} onChange={e => setForm({ ...form, servicePeriodTo: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Amount (₹)</label>
                  <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} />
                </div>
                {selectedClient && form.amount > 0 && (
                  <div className="p-3 bg-muted rounded-sm text-xs space-y-1">
                    <div className="flex justify-between"><span>Previous Due</span><span className="erp-mono">{formatCurrency(selectedClient.totalPending)}</span></div>
                    <div className="flex justify-between"><span>Amount Paid</span><span className="erp-mono">{formatCurrency(form.amount)}</span></div>
                    <div className="flex justify-between font-bold border-t pt-1"><span>Remaining Due</span><span className="erp-mono text-destructive">{formatCurrency(Math.max(0, selectedClient.totalPending - form.amount))}</span></div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleGenerate} disabled={!selectedClient || saving || form.amount <= 0}>{saving ? 'Generating...' : 'Generate'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="erp-kpi-card p-0 overflow-auto">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Client</th>
              <th>Handler</th>
              <th className="text-right">Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {fyInvoices.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No invoices generated yet.</td></tr>
            )}
            {fyInvoices.map(inv => (
              <tr key={inv.id}>
                <td className="erp-mono text-xs font-semibold">{inv.invoiceNo}</td>
                <td className="erp-mono text-xs">{inv.date}</td>
                <td className="text-xs">{inv.clientName}</td>
                <td className="erp-mono text-xs">{inv.handlerCode}</td>
                <td className="erp-mono text-xs text-right font-semibold">{formatCurrency(inv.total)}</td>
                <td><span className={`erp-badge ${inv.status === 'paid' ? 'erp-badge-success' : inv.status === 'draft' ? 'erp-badge-info' : 'erp-badge-warning'}`}>{(inv.status || 'pending').toUpperCase()}</span></td>
                <td className="space-x-1">
                  <Button size="sm" variant="outline" onClick={() => setPreviewInvoice(inv.id)} className="h-7 text-xs">View</Button>
                  {!isViewer && (
                    <Button size="sm" className="h-7 text-xs erp-btn-danger" onClick={() => setDeleteId(inv.id)}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewedInvoice && (
        <Dialog open={!!previewInvoice} onOpenChange={() => setPreviewInvoice(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Invoice Preview</DialogTitle></DialogHeader>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1"><Printer className="w-3 h-3" /> Print</Button>
              <Button size="sm" variant="outline" onClick={handleWhatsApp} className="gap-1"><Share2 className="w-3 h-3" /> WhatsApp</Button>
              <Button size="sm" variant="outline" onClick={handleEmail} className="gap-1"><Download className="w-3 h-3" /> Email</Button>
            </div>
            <div ref={printRef} className="border rounded-sm p-6 bg-card text-sm">
              <div className="flex justify-between mb-6">
                <div>
                  <p className="firm-name text-lg font-extrabold text-primary">KOTA ASSOCIATES</p>
                  <p className="subtitle text-[10px] text-muted-foreground">SECURED.TRUSTED.ASSURE</p>
                </div>
                <div className="text-right">
                  <p className="font-bold erp-mono text-base">{viewedInvoice.invoiceNo}</p>
                  <p className="text-xs text-muted-foreground">Date: {viewedInvoice.date}</p>
                  <p className="text-xs text-muted-foreground">FY: {viewedInvoice.financialYear}</p>
                </div>
              </div>

              <hr className="border-t-2 border-primary mb-4" />

              <div className="mb-4 p-3 bg-muted/30 rounded-sm">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bill To</p>
                <p className="font-semibold">{viewedInvoice.clientName}</p>
                <p className="text-xs">{viewedInvoice.clientPhone}</p>
                <p className="text-xs erp-mono">Client ID: {viewedInvoice.clientId}</p>
              </div>

              <table className="w-full text-sm border-collapse mb-4">
                <thead>
                  <tr className="bg-muted">
                    <th className="border px-3 py-2 text-left text-xs">Description</th>
                    <th className="border px-3 py-2 text-right text-xs">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {viewedInvoice.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="border px-3 py-2">{it.description}</td>
                      <td className="border px-3 py-2 text-right erp-mono">{formatCurrency(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="ml-auto w-64 space-y-1 text-sm">
                <div className="flex justify-between font-bold border-t-2 border-primary pt-2">
                  <span>Total Amount</span>
                  <span className="erp-mono text-lg">{formatCurrency(viewedInvoice.total)}</span>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center mt-6">This is a computer-generated invoice. No signature required.</p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!deleteId} onOpenChange={(next) => !next && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete invoice?</DialogTitle>
            <DialogDescription>This invoice and linked line items will be removed.</DialogDescription>
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
