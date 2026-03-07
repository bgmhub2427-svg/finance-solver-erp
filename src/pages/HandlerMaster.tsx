import React, { useState } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { UserCog, CheckCircle, Plus, UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { miniAuth, miniDB } from '@/lib/mini-supabase';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function HandlerMaster() {
  const { handlers, getHandlerStats, currentFY, refreshData } = useERP();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteHandlerId, setDeleteHandlerId] = useState<string | null>(null);
  const [deletingHandler, setDeletingHandler] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', email: '', password: '',
  });

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
      setForm({ code: '', name: '', email: '', password: '' });
      setOpen(false);
      await refreshData();
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><UserCog className="w-5 h-5" /> Handler Master</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{handlers.length} Registered Handlers — FY {currentFY}</p>
        </div>
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

      <Dialog open={!!deleteHandlerId} onOpenChange={(next) => !next && setDeleteHandlerId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Remove handler?</DialogTitle>
            <DialogDescription>This will remove the handler from the system. Existing client/payment records will retain the handler code.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteHandlerId(null)} disabled={deletingHandler}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteHandler} disabled={deletingHandler}>{deletingHandler ? 'Removing...' : 'Remove Handler'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
