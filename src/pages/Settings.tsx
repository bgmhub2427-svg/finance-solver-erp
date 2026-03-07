import { ShieldCheck, RotateCcw, Users, UserCog, Download, Upload, FileClock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { miniDB, resetDB, loadDB, saveDB } from '@/lib/mini-supabase';
import { useToast } from '@/hooks/use-toast';
import { useERP } from '@/lib/erp-store';

interface Summary {
  totalUsers: number;
  totalHandlers: number;
  roleCount: Record<string, number>;
}

const emptySummary: Summary = { totalUsers: 0, totalHandlers: 0, roleCount: { admin: 0, handler: 0, viewer: 0 } };

export default function Settings() {
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();
  const { refreshData } = useERP();
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSummary = async () => {
    const [{ data: users }, { data: handlers }, { data: logs }] = await Promise.all([
      miniDB.from('users').select('*'),
      miniDB.from('handlers').select('*'),
      miniDB.from('audit_logs').select('*').order('timestamp', { ascending: false }),
    ]);

    const roleCount = { admin: 0, handler: 0, viewer: 0 };
    (users || []).forEach((user: any) => {
      if (user.role in roleCount) roleCount[user.role as 'admin' | 'handler' | 'viewer'] += 1;
    });

    setSummary({ totalUsers: users?.length || 0, totalHandlers: handlers?.length || 0, roleCount });
    setAuditLogs((logs || []).slice(0, 50));
  };

  useEffect(() => { loadSummary(); }, []);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetDB();
      await refreshData();
      await loadSummary();
      toast({ title: 'Database reset complete', description: 'ERP database reset to default seed data.' });
    } catch (err: any) {
      toast({ title: 'Reset failed', description: err.message, variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  };

  const handleExport = async () => {
    const db = await loadDB();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `erp-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Backup exported successfully' });
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    await saveDB(parsed);
    await refreshData();
    await loadSummary();
    toast({ title: 'Backup restored successfully' });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="erp-page-title flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Admin-only system controls and enterprise summaries.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="erp-kpi-card flex items-start gap-3"><div className="bg-primary/10 text-primary p-2 rounded-sm"><Users className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Total Users</p><p className="erp-mono text-lg font-bold">{summary.totalUsers}</p></div></div>
        <div className="erp-kpi-card flex items-start gap-3"><div className="bg-blue-500/10 text-blue-500 p-2 rounded-sm"><UserCog className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Total Handlers</p><p className="erp-mono text-lg font-bold">{summary.totalHandlers}</p></div></div>
      </div>

      <div className="erp-kpi-card space-y-2">
        <h2 className="text-sm font-semibold">Role Distribution</h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="p-3 bg-red-500/10 rounded-sm"><p className="text-xs text-muted-foreground">Admin</p><p className="erp-mono font-bold">{summary.roleCount.admin}</p></div>
          <div className="p-3 bg-blue-500/10 rounded-sm"><p className="text-xs text-muted-foreground">Handler</p><p className="erp-mono font-bold">{summary.roleCount.handler}</p></div>
          <div className="p-3 bg-gray-500/10 rounded-sm"><p className="text-xs text-muted-foreground">Viewer</p><p className="erp-mono font-bold">{summary.roleCount.viewer}</p></div>
        </div>
      </div>

      <div className="erp-kpi-card flex items-center justify-between">
        <div><p className="text-sm font-semibold">Backup & Restore</p><p className="text-xs text-muted-foreground">Export or restore full ERP JSON database snapshot.</p></div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline"><Download className="w-4 h-4 mr-1" /> Export</Button>
          <Button onClick={() => fileRef.current?.click()} variant="outline"><Upload className="w-4 h-4 mr-1" /> Import</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleImportFile(f); e.currentTarget.value=''; }} />
        </div>
      </div>

      <div className="erp-kpi-card flex items-center justify-between">
        <div><p className="text-sm font-semibold">Reset Database</p><p className="text-xs text-muted-foreground">Restore default seed data. Removes current records.</p></div>
        <Button className="erp-btn-danger" onClick={handleReset} disabled={resetting}><RotateCcw className="w-4 h-4 mr-1" />{resetting ? 'Resetting...' : 'Reset DB'}</Button>
      </div>

      <div className="erp-kpi-card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/50 flex items-center gap-2"><FileClock className="w-4 h-4" /><h2 className="text-sm font-semibold">Audit Logs</h2></div>
        <table className="erp-table">
          <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Module</th><th>Record</th></tr></thead>
          <tbody>
            {auditLogs.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground text-sm">No audit logs yet.</td></tr>}
            {auditLogs.map((log) => (
              <tr key={log.id}><td className="erp-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td><td className="erp-mono text-xs">{log.user_id}</td><td className="text-xs uppercase">{log.role}</td><td className="text-xs uppercase">{log.action}</td><td className="text-xs">{log.module}</td><td className="erp-mono text-xs">{log.record_id}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
