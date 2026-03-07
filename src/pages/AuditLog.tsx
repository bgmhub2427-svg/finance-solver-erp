import { useMemo, useState, useEffect } from 'react';
import { miniDB } from '@/lib/mini-supabase';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, ScrollText } from 'lucide-react';

interface AuditEntry {
  id: string;
  user_id: string;
  user_email?: string;
  role: string;
  action: string;
  module: string;
  record_id: string;
  ip_address?: string;
  timestamp: string;
}

export default function AuditLog() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<AuditEntry[]>([]);

  useEffect(() => {
    async function loadLogs() {
      const { data } = await miniDB.from('audit_logs').select('*').order('timestamp', { ascending: false });
      if (data) setLogs(data as AuditEntry[]);
    }
    loadLogs();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      l.action.toLowerCase().includes(q) ||
      l.module.toLowerCase().includes(q) ||
      l.record_id?.toLowerCase().includes(q) ||
      l.user_id?.toLowerCase().includes(q) ||
      (l.user_email || '').toLowerCase().includes(q)
    );
  }, [logs, search]);

  const actionColor = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('login') || a.includes('logout') || a.includes('signup')) return 'bg-[hsl(var(--info)/0.1)] text-[hsl(var(--info))]';
    if (a.includes('create') || a.includes('approve') || a.includes('post')) return 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]';
    if (a.includes('delete') || a.includes('reject')) return 'bg-destructive/10 text-destructive';
    if (a.includes('update') || a.includes('upload')) return 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]';
    if (a.includes('restore')) return 'bg-[hsl(var(--info)/0.1)] text-[hsl(var(--info))]';
    return 'bg-muted text-muted-foreground';
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Admin access required</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><ScrollText className="w-5 h-5" /> Audit Log</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} entries — All financial operations are logged</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Record ID</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="erp-mono text-xs">{new Date(log.timestamp).toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-xs">{log.user_email || log.user_id?.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs uppercase">{log.role}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${actionColor(log.action)}`}>{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.module}</TableCell>
                  <TableCell className="erp-mono text-xs truncate max-w-[150px]">{log.record_id?.slice(0, 12)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.ip_address || '—'}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No audit logs found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
