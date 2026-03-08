import React, { useState } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { MONTHS, FINANCIAL_YEARS } from '@/lib/erp-types';
import type { Client } from '@/lib/erp-types';
import { Plus, Trash2, Users, Search, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { playClientAdded, playClick, playError, playSuccess } from '@/lib/sound-engine';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import DeleteAuthModal from '@/components/DeleteAuthModal';
import { miniDB } from '@/lib/mini-supabase';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function ClientMaster() {
  const { clients, handlers, currentFY, addClient, updateClient, removeClientWithAuth, restoreClient } = useERP();
  const { isAdmin, isViewer, handlerCode, role } = useAuth();
  const { toast } = useToast();
  const fyClients = clients.filter(c => c.financialYear === currentFY);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    clientId: '', name: '', phone: '', gstNumber: '', pan: '', status: 'active' as 'active' | 'inactive', handlerCode: handlers[0]?.code || 'K-A-H-001',
    oldFee: 0, oldFeeEndMonth: 'March', oldFeeDue: 0,
    newFee: 0, newFeeStartMonth: 'April', newFeeDue: 0,
    previousYearPending: 0,
    // Pending tracking fields
    pendingFromYear: FINANCIAL_YEARS[0],
    pendingFromMonth: 'April',
    pendingToYear: currentFY,
    pendingToMonth: 'March',
  }));
  const [saving, setSaving] = useState(false);
  const [deletedClients, setDeletedClients] = useState<any[]>([]);

  // Fee collector cannot edit/add clients
  const canEditClients = role !== 'fee_collector' && role !== 'viewer';

  const generateClientId = () => {
    const allIds = clients.map(c => {
      const match = c.clientId.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const nextNum = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;
    return `C-${String(nextNum).padStart(3, '0')}`;
  };

  const filtered = fyClients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.clientId.toLowerCase().includes(search.toLowerCase()) ||
    c.handlerCode.toLowerCase().includes(search.toLowerCase()) ||
    c.gstNumber.toLowerCase().includes(search.toLowerCase())
  );

  const canDeleteClient = (id: string) => {
    if (isViewer || role === 'fee_collector') return false;
    if (isAdmin) return true;
    const found = filtered.find((c) => c.id === id);
    return !!(found && handlerCode && found.handlerCode === handlerCode);
  };

  const handleAdd = async () => {
    if (!form.clientId || !form.name) return;
    setSaving(true);
    try {
      await addClient({ ...form, financialYear: currentFY });
      playClientAdded();
      setForm({
        clientId: '', name: '', phone: '', gstNumber: '', pan: '', status: 'active' as 'active' | 'inactive', handlerCode: handlers[0]?.code || 'K-A-H-001',
        oldFee: 0, oldFeeEndMonth: 'March', oldFeeDue: 0, newFee: 0, newFeeStartMonth: 'April', newFeeDue: 0,
        pendingFromYear: FINANCIAL_YEARS[0], pendingFromMonth: 'April',
        pendingToYear: currentFY, pendingToMonth: 'March',
      });
      setOpen(false);
      toast({ title: 'Client added successfully' });
    } catch (err: any) {
      playError();
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const loadDeletedClients = async () => {
    if (!isAdmin) return;
    const { data } = await miniDB.from('clients').select('*').eq('deleted', true);
    setDeletedClients(data || []);
  };

  const handleRestoreClient = async (id: string) => {
    await restoreClient(id);
    await loadDeletedClients();
  };

  const handleSecureDelete = async (password: string) => {
    if (!deleteClientId) return;
    setDeleting(true);
    try {
      await removeClientWithAuth(deleteClientId, password);
      toast({ title: 'Client deleted successfully' });
      await loadDeletedClients();
      setDeleteClientId(null);
    } catch (err: any) {
      toast({ title: 'Deletion blocked', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const openEditDialog = (c: Client) => {
    setEditClient(c);
    setEditForm({
      name: c.name, phone: c.phone, gstNumber: c.gstNumber, pan: c.pan || '',
      status: c.status || 'active', handlerCode: c.handlerCode,
      oldFee: c.oldFee, oldFeeEndMonth: c.oldFeeEndMonth, oldFeeDue: c.oldFeeDue,
      newFee: c.newFee, newFeeStartMonth: c.newFeeStartMonth, newFeeDue: c.newFeeDue,
    });
  };

  const handleEditSave = async () => {
    if (!editClient) return;
    setEditSaving(true);
    try {
      await updateClient(editClient.id, editForm);
      playSuccess();
      toast({ title: 'Client updated successfully' });
      setEditClient(null);
    } catch (err: any) {
      playError();
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  React.useEffect(() => { loadDeletedClients(); }, [isAdmin]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><Users className="w-5 h-5" /> Client Master</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{fyClients.length} Clients — FY {currentFY}</p>
        </div>
        {canEditClients && (
          <Dialog open={open} onOpenChange={(next) => {
            if (next) { setForm(f => ({ ...f, clientId: generateClientId() })); playClick(); }
            setOpen(next);
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="w-3.5 h-3.5" /> Add Client</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground">Client ID</label>
                  <Input value={form.clientId} readOnly className="bg-muted cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Client Name</label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Client name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Phone</label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91..." />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">GST Number</label>
                  <Input value={form.gstNumber} onChange={e => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })} placeholder="29ABCDE1234F1Z5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">PAN (optional)</label>
                  <Input value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Handler</label>
                  <select value={form.handlerCode} onChange={e => setForm({ ...form, handlerCode: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                    {handlers.map(h => <option key={h.code} value={h.code}>{h.code} — {h.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Old Fee (₹/month)</label>
                  <Input type="number" value={form.oldFee} onChange={e => setForm({ ...form, oldFee: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Old Fee End Month</label>
                  <select value={form.oldFeeEndMonth} onChange={e => setForm({ ...form, oldFeeEndMonth: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                    {MONTHS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Old Fee Due (₹)</label>
                  <Input type="number" value={form.oldFeeDue} onChange={e => setForm({ ...form, oldFeeDue: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">New Fee (₹/month)</label>
                  <Input type="number" value={form.newFee} onChange={e => setForm({ ...form, newFee: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">New Fee Start Month</label>
                  <select value={form.newFeeStartMonth} onChange={e => setForm({ ...form, newFeeStartMonth: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                    {MONTHS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">New Fee Due (₹)</label>
                  <Input type="number" value={form.newFeeDue} onChange={e => setForm({ ...form, newFeeDue: +e.target.value })} />
                </div>

                {/* Pending Tracking Fields */}
                <div className="col-span-2 border-t pt-2 mt-1">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">📅 Pending Duration Tracking</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Pending From Year</label>
                  <select value={form.pendingFromYear} onChange={e => setForm({ ...form, pendingFromYear: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                    {FINANCIAL_YEARS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Pending From Month</label>
                  <select value={form.pendingFromMonth} onChange={e => setForm({ ...form, pendingFromMonth: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                    {MONTHS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Pending To Year</label>
                  <select value={form.pendingToYear} onChange={e => setForm({ ...form, pendingToYear: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                    {FINANCIAL_YEARS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Pending To Month</label>
                  <select value={form.pendingToMonth} onChange={e => setForm({ ...form, pendingToMonth: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                    {MONTHS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAdd} disabled={saving}>{saving ? 'Saving...' : 'Add Client'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="pl-8 h-9 text-sm" />
      </div>

      <div className="erp-kpi-card p-0 overflow-auto">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>GST</th>
              <th>Handler</th>
              <th className="text-right">Old Fee</th>
              <th className="text-right">New Fee</th>
              <th className="text-right">Total Due</th>
              <th className="text-right">Paid</th>
              <th className="text-right text-warning">Prev Yr Pending</th>
              <th className="text-right">Pending</th>
              <th>Status</th>
              {canEditClients && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={canEditClients ? 13 : 12} className="text-center py-8 text-muted-foreground text-sm">No clients found.</td></tr>
            )}
            {filtered.map(c => {
              // Calculate previous year pending
              const fyParts = currentFY.split('-').map(Number);
              const prevFY = `${fyParts[0] - 1}-${fyParts[1] - 1}`;
              const prevClient = clients.find(pc => pc.clientId === c.clientId && pc.financialYear === prevFY);
              const prevYearPending = prevClient ? prevClient.totalPending : 0;

              return (
                <tr key={c.id}>
                  <td className="erp-mono text-xs">{c.clientId}</td>
                  <td className="font-medium text-xs">{c.name}</td>
                  <td className="erp-mono text-xs">{c.phone}</td>
                  <td className="erp-mono text-xs">{c.gstNumber || '—'}</td>
                  <td className="erp-mono text-xs">{c.handlerCode}</td>
                  <td className="erp-mono text-xs text-right">{formatCurrency(c.oldFee)}</td>
                  <td className="erp-mono text-xs text-right">{formatCurrency(c.newFee)}</td>
                  <td className="erp-mono text-xs text-right">{formatCurrency(c.oldFeeDue + c.newFeeDue)}</td>
                  <td className="erp-mono text-xs text-right">{formatCurrency(c.totalPaidFY)}</td>
                  <td className="erp-mono text-xs text-right font-semibold text-warning">{prevYearPending > 0 ? formatCurrency(prevYearPending) : '—'}</td>
                  <td className="erp-mono text-xs text-right font-bold text-destructive">{formatCurrency(c.totalPending)}</td>
                  <td>
                    {c.totalPending === 0 ? (
                      <span className="erp-badge erp-badge-success">PAID</span>
                    ) : (
                      <span className="erp-badge erp-badge-danger">DUE</span>
                    )}
                  </td>
                  {canEditClients && (
                    <td className="flex items-center gap-1">
                      {isAdmin && (
                        <button onClick={() => openEditDialog(c)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteClient(c.id) && (
                        <button onClick={() => setDeleteClientId(c.id)} className="text-destructive/70 hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isAdmin && deletedClients.length > 0 && (
        <div className="erp-kpi-card">
          <h3 className="text-sm font-semibold mb-2">Recently Deleted Clients</h3>
          <div className="space-y-1">
            {deletedClients.map((dc) => (
              <div key={dc.id} className="flex items-center justify-between text-xs">
                <span className="erp-mono">{dc.client_id} — {dc.name}</span>
                <Button size="sm" variant="outline" onClick={() => handleRestoreClient(dc.id)}>Restore</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <DeleteAuthModal
        open={!!deleteClientId}
        loading={deleting}
        onOpenChange={(next) => !next && setDeleteClientId(null)}
        onConfirm={handleSecureDelete}
      />

      {/* Admin Edit Dialog */}
      <Dialog open={!!editClient} onOpenChange={(next) => !next && setEditClient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="text-xs text-muted-foreground">Client Name</label>
              <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">GST Number</label>
              <Input value={editForm.gstNumber || ''} onChange={e => setEditForm({ ...editForm, gstNumber: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">PAN</label>
              <Input value={editForm.pan || ''} onChange={e => setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select value={editForm.status || 'active'} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Handler</label>
              <select value={editForm.handlerCode || ''} onChange={e => setEditForm({ ...editForm, handlerCode: e.target.value })} className="w-full border rounded-sm px-2 py-2 text-sm bg-background">
                {handlers.map(h => <option key={h.code} value={h.code}>{h.code} — {h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Old Fee (₹)</label>
              <Input type="number" value={editForm.oldFee ?? 0} onChange={e => setEditForm({ ...editForm, oldFee: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Old Fee Due (₹)</label>
              <Input type="number" value={editForm.oldFeeDue ?? 0} onChange={e => setEditForm({ ...editForm, oldFeeDue: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">New Fee (₹)</label>
              <Input type="number" value={editForm.newFee ?? 0} onChange={e => setEditForm({ ...editForm, newFee: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">New Fee Due (₹)</label>
              <Input type="number" value={editForm.newFeeDue ?? 0} onChange={e => setEditForm({ ...editForm, newFeeDue: +e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
