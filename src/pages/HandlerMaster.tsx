import React, { useState, useEffect } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { UserCog, CheckCircle, Plus, UserPlus, Trash2, Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { miniAuth, miniDB } from '@/lib/mini-supabase';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function HandlerMaster() {
  const { handlers, clients, getHandlerStats, currentFY, refreshData } = useERP();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteHandlerId, setDeleteHandlerId] = useState<string | null>(null);
  const [deletingHandler, setDeletingHandler] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', email: '', password: '',
  });

  // Unassigned clients assignment
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [newHandlerCode, setNewHandlerCode] = useState('');
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());

  // Get unassigned clients (handler_code is empty, deleted handler, or explicitly unassigned)
  const activeHandlerCodes = new Set(handlers.map(h => h.code));
  const unassignedClients = clients.filter(
    c => c.financialYear === currentFY && (!c.handlerCode || c.handlerCode === '__unassigned__' || !activeHandlerCodes.has(c.handlerCode))
  );

  const handleCreateHandler = async () => {
    if (!form.code || !form.name || !form.email || !form.password) return;
    setSaving(true);
    try {
      const { data, error } = await miniAuth.createHandlerUser({
        email: form.email,
        password: form.password,
        handler_code: form.code,
        handler_name: form.name,
      });
      if (error) throw error;
      toast({ title: 'Handler created', description: `${form.name} (${form.email}) can now sign in.` });
      setNewHandlerCode(form.code);
      setForm({ code: '', name: '', email: '', password: '' });
      setOpen(false);
      await refreshData();

      // Check if there are unassigned clients to show popup
      if (unassignedClients.length > 0) {
        setSelectedUnassigned(new Set());
        setShowAssignDialog(true);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHandler = async () => {
    if (!deleteHandlerId) return;
    setDeletingHandler(true);
    try {
      const handler = handlers.find(h => h.id === deleteHandlerId);
      const handlerCode = handler?.code;

      // Unassign clients instead of deleting them
      if (handlerCode) {
        const handlerClients = clients.filter(c => c.handlerCode === handlerCode);
        for (const client of handlerClients) {
          await miniDB.from('clients').update({
            handler_code: '__unassigned__',
            handler_id: null,
          }).eq('id', client.id);
        }
        if (handlerClients.length > 0) {
          toast({ title: `${handlerClients.length} client(s) unassigned`, description: 'They can be reassigned when creating a new handler.' });
        }
      }

      const { error } = await miniDB.from('handlers').delete().eq('id', deleteHandlerId);
      if (error) throw error;
      toast({ title: 'Handler removed successfully' });
      setDeleteHandlerId(null);
      await refreshData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingHandler(false);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedUnassigned.size === 0 || !newHandlerCode) return;
    const targetHandler = handlers.find(h => h.code === newHandlerCode);
    const handlerId = targetHandler?.userId || null;

    try {
      for (const clientId of selectedUnassigned) {
        await miniDB.from('clients').update({
          handler_code: newHandlerCode,
          handler_id: handlerId,
        }).eq('id', clientId);
      }
      toast({ title: `${selectedUnassigned.size} client(s) assigned to ${newHandlerCode}` });
      setShowAssignDialog(false);
      setSelectedUnassigned(new Set());
      await refreshData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const toggleSelectAll = () => {
    if (selectedUnassigned.size === unassignedClients.length) {
      setSelectedUnassigned(new Set());
    } else {
      setSelectedUnassigned(new Set(unassignedClients.map(c => c.id)));
    }
  };

  const toggleClient = (id: string) => {
    const next = new Set(selectedUnassigned);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedUnassigned(next);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><UserCog className="w-5 h-5" /> Handler Master</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {handlers.length} Registered Handlers — FY {currentFY}
            {unassignedClients.length > 0 && (
              <span className="ml-2 text-amber-500 font-medium">• {unassignedClients.length} unassigned client(s)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && unassignedClients.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
              onClick={() => { setShowAssignDialog(true); setSelectedUnassigned(new Set()); }}
            >
              <Users className="w-3.5 h-3.5" /> Assign Clients ({unassignedClients.length})
            </Button>
          )}
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><UserPlus className="w-3.5 h-3.5" /> Create New Handler</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Create New Handler Account</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Handler Code</label>
                      <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="K-A-H-013" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Handler Name</label>
                      <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full Name" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Login Email</label>
                    <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="handler@kotaassociates.com" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Login Password</label>
                    <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" minLength={6} />
                  </div>
                  <div className="p-2 bg-muted rounded-sm text-xs text-muted-foreground">
                    This will create a login account for the handler. They can sign in with the email and password you set here.
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateHandler} disabled={saving || !form.code || !form.name || !form.email || !form.password}>
                    {saving ? 'Creating...' : 'Create Handler'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {handlers.map(h => {
          const stats = getHandlerStats(h.code);
          return (
            <div key={h.code} className="erp-kpi-card space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="erp-mono text-xs text-muted-foreground">{h.code}</p>
                  <p className="font-semibold text-sm">{h.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button onClick={() => setDeleteHandlerId(h.id)} className="text-destructive/70 hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Clients</p>
                  <p className="erp-mono text-sm font-bold">{stats.totalClients}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Collected</p>
                  <p className="erp-mono text-xs font-bold">{formatCurrency(stats.totalCollected)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
                  <p className="erp-mono text-xs font-bold">{formatCurrency(stats.totalPending)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Handler Confirmation */}
      <Dialog open={!!deleteHandlerId} onOpenChange={(next) => !next && setDeleteHandlerId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Remove handler?</DialogTitle>
            <DialogDescription>
              The handler will be removed but their clients will be <strong>preserved as unassigned</strong>. You can reassign them to another handler later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteHandlerId(null)} disabled={deletingHandler}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteHandler} disabled={deletingHandler}>{deletingHandler ? 'Removing...' : 'Remove Handler'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Unassigned Clients Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" /> Assign Unassigned Clients
            </DialogTitle>
            <DialogDescription>
              {unassignedClients.length} client(s) are unassigned. Select clients and assign them to a handler.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Target handler selector */}
            <div>
              <label className="text-xs text-muted-foreground font-medium">Assign to Handler</label>
              <select
                value={newHandlerCode}
                onChange={e => setNewHandlerCode(e.target.value)}
                className="w-full border rounded-sm px-2 py-2 text-sm bg-background mt-1"
              >
                <option value="">Select handler...</option>
                {handlers.map(h => (
                  <option key={h.code} value={h.code}>{h.code} — {h.name}</option>
                ))}
              </select>
            </div>

            {/* Select all */}
            <div className="flex items-center justify-between border-b pb-2">
              <button onClick={toggleSelectAll} className="text-xs text-primary font-medium hover:underline">
                {selectedUnassigned.size === unassignedClients.length ? 'Deselect All' : `Select All (${unassignedClients.length})`}
              </button>
              <span className="text-xs text-muted-foreground">{selectedUnassigned.size} selected</span>
            </div>

            {/* Client list */}
            <div className="max-h-[40vh] overflow-y-auto space-y-1">
              {unassignedClients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No unassigned clients.</p>
              ) : (
                unassignedClients.map(c => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 p-2 rounded-sm cursor-pointer transition-colors ${
                      selectedUnassigned.has(c.id) ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50 border border-transparent'
                    }`}
                  >
                    <Checkbox
                      checked={selectedUnassigned.has(c.id)}
                      onCheckedChange={() => toggleClient(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        ID: {c.clientId} • {c.phone || 'No phone'} • Prev Handler: {c.handlerCode === '__unassigned__' ? '—' : c.handlerCode}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="erp-mono text-xs font-bold">₹{(c.totalPending || 0).toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-muted-foreground">pending</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button
              onClick={handleBulkAssign}
              disabled={selectedUnassigned.size === 0 || !newHandlerCode}
              className="gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Assign {selectedUnassigned.size} Client(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
