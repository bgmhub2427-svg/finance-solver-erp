import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useERP } from '@/lib/erp-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Lock, Unlock } from 'lucide-react';
import { MONTHS } from '@/lib/erp-types';

const MONTH_SHORTS = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR'];

export default function MonthLock() {
  const { isAdmin } = useAuth();
  const { payments, currentFY } = useERP();
  const { toast } = useToast();
  const [lockedMonths, setLockedMonths] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('erp_month_locks');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const fyPayments = useMemo(() => payments.filter(p => p.financialYear === currentFY), [payments, currentFY]);

  const monthStats = MONTH_SHORTS.map((m, i) => {
    const fullMonth = MONTHS[i];
    const monthPayments = fyPayments.filter(p => p.paidTermFrom === fullMonth);
    const total = monthPayments.length;
    const posted = monthPayments.filter(p => (p as any).approvalStatus === 'posted' || (p as any).approvalStatus === 'locked').length;
    const pending = monthPayments.filter(p => !(p as any).approvalStatus || (p as any).approvalStatus === 'pending_approval').length;
    const lockKey = `${currentFY}_${m}`;
    const locked = lockedMonths.has(lockKey);
    return { month: m, fullMonth, total, posted, pending, locked, lockKey };
  });

  const handleLock = useCallback((lockKey: string, month: string) => {
    setLockedMonths(prev => {
      const next = new Set(prev);
      next.add(lockKey);
      localStorage.setItem('erp_month_locks', JSON.stringify([...next]));
      return next;
    });
    toast({ title: 'Month Locked', description: `${month} ${currentFY} has been locked. No further edits allowed.` });
  }, [currentFY, toast]);

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Admin access required</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="erp-page-title">Month Lock</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Financial Year {currentFY} — Lock months after final approval to prevent edits</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {monthStats.map(ms => (
          <Card key={ms.month} className={ms.locked ? 'border-muted opacity-75' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                {ms.month}
                {ms.locked ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Unlock className="w-4 h-4 text-[hsl(var(--success))]" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Records</span>
                <span className="erp-mono">{ms.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Posted</span>
                <span className="erp-mono">{ms.posted}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending</span>
                <Badge variant={ms.pending > 0 ? 'destructive' : 'secondary'} className="text-xs">{ms.pending}</Badge>
              </div>
              {!ms.locked && ms.total > 0 && (
                <Button
                  size="sm"
                  className="w-full mt-2"
                  variant={ms.pending > 0 ? 'outline' : 'default'}
                  onClick={() => handleLock(ms.lockKey, ms.month)}
                  disabled={ms.pending > 0}
                >
                  <Lock className="w-3 h-3 mr-1" /> {ms.pending > 0 ? 'Resolve Pending First' : 'Lock Month'}
                </Button>
              )}
              {ms.locked && <Badge className="status-badge status-locked w-full justify-center">Locked</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
