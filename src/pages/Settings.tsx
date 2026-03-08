import { ShieldCheck, RotateCcw, Users, UserCog, Download, Upload, FileClock, Clock, HardDrive, Minus, Plus, Key, Building2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { miniDB, resetDB, loadDB, saveDB } from '@/lib/mini-supabase';
import { useToast } from '@/hooks/use-toast';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import { playSyncSuccess, playError, playClick } from '@/lib/sound-engine';
import { getBackupInterval, setBackupInterval, getLastBackupTime, type BackupInterval } from '@/lib/auto-backup';
import { ROLE_LABELS, type RoleLimits } from '@/lib/org-types';

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
  const [backupFreq, setBackupFreq] = useState<BackupInterval>(getBackupInterval());
  const { toast } = useToast();
  const { refreshData } = useERP();
  const { user, role } = useAuth();
  const { org, updateOrgConfig } = useOrg();
  const fileRef = useRef<HTMLInputElement>(null);

  const lastBackup = getLastBackupTime();
  const lastBackupStr = lastBackup ? new Date(lastBackup).toLocaleString() : 'Never';

  const roleLimits: RoleLimits = org?.config?.role_limits || { admin: 2, manager: 3, handler: 10, viewer: 5, fee_collector: 3 };

  const loadSummary = async () => {
    const [{ data: users }, { data: handlers }, { data: logs }] = await Promise.all([
      miniDB.from('users').select('*'),
      miniDB.from('handlers').select('*'),
      miniDB.from('audit_logs').select('*').order('timestamp', { ascending: false }),
    ]);

    const roleCount: Record<string, number> = { admin: 0, manager: 0, handler: 0, viewer: 0, fee_collector: 0 };
    (users || []).forEach((u: any) => {
      if (u.role in roleCount) roleCount[u.role] += 1;
    });

    setSummary({ totalUsers: users?.length || 0, totalHandlers: handlers?.length || 0, roleCount });
    setAuditLogs((logs || []).slice(0, 50));
  };

  useEffect(() => { loadSummary(); }, []);

  const adjustRoleLimit = (roleKey: keyof RoleLimits, delta: number) => {
    const newLimits = { ...roleLimits, [roleKey]: Math.max(0, Math.min(99, roleLimits[roleKey] + delta)) };
    updateOrgConfig({ role_limits: newLimits });
    playClick();
    toast({ title: 'Role limit updated', description: `${ROLE_LABELS[roleKey]}: ${newLimits[roleKey]}` });
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetDB();
      await refreshData();
      await loadSummary();
      playSyncSuccess();
      toast({ title: 'Database reset complete', description: 'ERP database reset to default seed data.' });
    } catch (err: any) {
      playError();
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
    playSyncSuccess();
    toast({ title: 'Backup exported successfully' });
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    await saveDB(parsed);
    await refreshData();
    await loadSummary();
    playSyncSuccess();
    toast({ title: 'Backup restored successfully' });
  };

  const handleBackupFreqChange = (freq: BackupInterval) => {
    setBackupFreq(freq);
    setBackupInterval(freq);
    playClick();
    toast({ title: 'Auto-backup updated', description: freq === 'off' ? 'Auto-backup disabled.' : `Database will auto-export ${freq}.` });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="erp-page-title flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Admin-only system controls, credentials, and organization config.</p>
      </div>

      {/* Your Credentials */}
      <div className="erp-kpi-card space-y-3">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Your Credentials</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border border-border/40">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</p>
            <p className="text-sm font-mono font-medium truncate">{user?.email || '—'}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/40">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Role</p>
            <p className="text-sm font-semibold uppercase">{role || '—'}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/40">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">User ID</p>
            <p className="text-xs font-mono truncate">{user?.id || '—'}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/40">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Organization</p>
            <p className="text-sm font-medium truncate">{org?.name || '—'}</p>
          </div>
        </div>
      </div>

      {/* Organization Info */}
      {org && (
        <div className="erp-kpi-card space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Organization Details</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border/40">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Org Type</p>
              <p className="text-sm font-medium capitalize">{org.config.org_type?.replace('_', ' ')}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/40">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Team Size</p>
              <p className="text-sm font-medium">{org.config.team_size}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/40">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Billing</p>
              <p className="text-sm font-medium capitalize">{org.config.billing_model?.replace('_', ' ')}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/40 col-span-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Services</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(org.config.services || []).map(s => (
                  <span key={s} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full font-medium capitalize">{s.replace('_', ' ')}</span>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/40">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Owner</p>
              <p className="text-xs font-mono truncate">{org.owner_email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Role Limits */}
      <div className="erp-kpi-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Role Limits</h2>
              <p className="text-[10px] text-muted-foreground">Maximum number of users per role. Adjust as needed.</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(Object.keys(roleLimits) as (keyof RoleLimits)[]).map(roleKey => {
            const current = summary.roleCount[roleKey] || 0;
            const limit = roleLimits[roleKey];
            return (
              <div key={roleKey} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/30">
                <div>
                  <p className="text-xs font-medium">{ROLE_LABELS[roleKey]}</p>
                  <p className="text-[10px] text-muted-foreground">{current} / {limit} used</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustRoleLimit(roleKey, -1)}
                    className="w-6 h-6 rounded border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="erp-mono text-sm font-bold w-5 text-center">{limit}</span>
                  <button
                    onClick={() => adjustRoleLimit(roleKey, 1)}
                    className="w-6 h-6 rounded border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="erp-kpi-card flex items-start gap-3"><div className="bg-primary/10 text-primary p-2 rounded-sm"><Users className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Total Users</p><p className="erp-mono text-lg font-bold">{summary.totalUsers}</p></div></div>
        <div className="erp-kpi-card flex items-start gap-3"><div className="bg-primary/10 text-primary p-2 rounded-sm"><UserCog className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Total Handlers</p><p className="erp-mono text-lg font-bold">{summary.totalHandlers}</p></div></div>
      </div>

      <div className="erp-kpi-card space-y-2">
        <h2 className="text-sm font-semibold">Role Distribution (Current)</h2>
        <div className="grid grid-cols-5 gap-2 text-sm">
          {(Object.keys(roleLimits) as (keyof RoleLimits)[]).map(roleKey => (
            <div key={roleKey} className="p-3 bg-primary/5 rounded-sm text-center">
              <p className="text-[10px] text-muted-foreground capitalize">{roleKey.replace('_', ' ')}</p>
              <p className="erp-mono font-bold">{summary.roleCount[roleKey] || 0}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Auto-Backup Scheduler */}
      <div className="erp-kpi-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Auto-Backup Scheduler</p>
              <p className="text-xs text-muted-foreground">Automatically export database backup to downloads folder.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(['off', 'daily', 'weekly'] as BackupInterval[]).map(freq => (
              <button
                key={freq}
                onClick={() => handleBackupFreqChange(freq)}
                className={`px-3 py-1.5 text-xs rounded-sm font-medium transition-colors ${
                  backupFreq === freq
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {freq === 'off' ? 'Off' : freq === 'daily' ? 'Daily' : 'Weekly'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <HardDrive className="w-3 h-3" />
            <span>Last backup: {lastBackupStr}</span>
          </div>
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

      {/* Platform footer */}
      <div className="text-center py-4 border-t border-border/30">
        <p className="text-[10px] text-muted-foreground">Finance Solver — F.S.001 • Created by Kota Associates</p>
      </div>
    </div>
  );
}
