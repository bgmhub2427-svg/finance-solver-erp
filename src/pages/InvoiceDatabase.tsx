import React, { useState } from 'react';
import { useERP } from '@/lib/erp-store';
import { miniDB } from '@/lib/mini-supabase';
import { useAuth } from '@/hooks/useAuth';
import { FileSpreadsheet, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function InvoiceDatabase() {
  const { invoices, currentFY, removeInvoice, restoreInvoice } = useERP();
  const { isViewer, isAdmin } = useAuth();
  const { toast } = useToast();
  const fyInvoices = invoices.filter(i => i.financialYear === currentFY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletedInvoices, setDeletedInvoices] = useState<any[]>([]);

  const loadDeletedInvoices = async () => {
    if (!isAdmin) return;
    const { data } = await miniDB.from('invoices').select('*').eq('deleted', true);
    setDeletedInvoices(data || []);
  };

  const handleRestore = async (id: string) => {
    await restoreInvoice(id);
    await loadDeletedInvoices();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await removeInvoice(deleteId);
      setDeleteId(null);
      await loadDeletedInvoices();
      toast({ title: 'Invoice deleted successfully' });
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  React.useEffect(() => { loadDeletedInvoices(); }, [isAdmin]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="erp-page-title flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Invoice Database</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{fyInvoices.length} Records — FY {currentFY}</p>
      </div>

      <div className="erp-kpi-card p-0 overflow-auto">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th>Client ID</th>
              <th>Client Name</th>
              <th>Handler</th>
              <th className="text-right">Subtotal</th>
              <th className="text-right">GST</th>
              <th>Status</th>
              <th className="text-right">Total</th>
              {!isViewer && <th></th>}
            </tr>
          </thead>
          <tbody>
            {fyInvoices.length === 0 && (
              <tr><td colSpan={isViewer ? 8 : 9} className="text-center py-8 text-muted-foreground text-sm">No invoice records.</td></tr>
            )}
            {fyInvoices.map(inv => (
              <tr key={inv.id}>
                <td className="erp-mono text-xs font-semibold">{inv.invoiceNo}</td>
                <td className="erp-mono text-xs">{inv.date}</td>
                <td className="erp-mono text-xs">{inv.clientId}</td>
                <td className="text-xs">{inv.clientName}</td>
                <td className="erp-mono text-xs">{inv.handlerCode}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(inv.subtotal)}</td>
                <td className="erp-mono text-xs text-right">{formatCurrency(inv.gst)}</td>
                <td><span className={`erp-badge ${inv.status === "paid" ? "erp-badge-success" : inv.status === "draft" ? "erp-badge-info" : "erp-badge-warning"}`}>{(inv.status || "pending").toUpperCase()}</span></td>
                <td className="erp-mono text-xs text-right font-semibold">{formatCurrency(inv.total)}</td>
                {!isViewer && (
                  <td>
                    <Button size="sm" className="h-7 text-xs erp-btn-danger" onClick={() => setDeleteId(inv.id)}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && deletedInvoices.length > 0 && (
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">Deleted Invoices</h3>
          <div className="space-y-1">
            {deletedInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-xs">
                <span className="erp-mono">{inv.invoice_no} — {inv.client_name}</span>
                <Button size="sm" variant="outline" onClick={() => handleRestore(inv.id)}>Restore</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={(next) => !next && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete invoice record?</DialogTitle>
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
