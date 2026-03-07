import React, { useMemo } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert, TrendingDown, AlertTriangle, Copy, Banknote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

interface RiskFlag {
  id: string;
  type: 'large_deviation' | 'frequent_correction' | 'cash_heavy' | 'duplicate_payment';
  severity: 'high' | 'medium' | 'low';
  description: string;
  clientId?: string;
  clientName?: string;
  handlerCode?: string;
  amount?: number;
  timestamp: string;
}

export default function RiskDetection() {
  const { payments, clients, handlers, currentFY } = useERP();
  const { isAdmin } = useAuth();

  const fyPayments = useMemo(() => payments.filter(p => p.financialYear === currentFY), [payments, currentFY]);
  const fyClients = useMemo(() => clients.filter(c => c.financialYear === currentFY), [clients, currentFY]);

  const riskFlags = useMemo(() => {
    const flags: RiskFlag[] = [];

    // 1. Large payment deviations (payment < 30% or > 200% of due)
    fyPayments.forEach(p => {
      if (p.dueAmount > 0) {
        const ratio = p.payment / p.dueAmount;
        if (ratio < 0.3 && p.payment > 0) {
          flags.push({
            id: `dev-${p.id}`,
            type: 'large_deviation',
            severity: 'high',
            description: `Payment ${formatCurrency(p.payment)} is only ${(ratio * 100).toFixed(0)}% of due ${formatCurrency(p.dueAmount)}`,
            clientId: p.clientId,
            clientName: p.clientName,
            handlerCode: p.handlerCode,
            amount: p.payment,
            timestamp: p.date,
          });
        }
        if (ratio > 2) {
          flags.push({
            id: `over-${p.id}`,
            type: 'large_deviation',
            severity: 'medium',
            description: `Overpayment: ${formatCurrency(p.payment)} is ${(ratio * 100).toFixed(0)}% of due ${formatCurrency(p.dueAmount)}`,
            clientId: p.clientId,
            clientName: p.clientName,
            handlerCode: p.handlerCode,
            amount: p.payment,
            timestamp: p.date,
          });
        }
      }
    });

    // 2. Duplicate payments (same client, same date, same amount)
    const paymentMap = new Map<string, typeof fyPayments>();
    fyPayments.forEach(p => {
      const key = `${p.clientId}-${p.date}-${p.payment}`;
      const arr = paymentMap.get(key) || [];
      arr.push(p);
      paymentMap.set(key, arr);
    });
    paymentMap.forEach((group, key) => {
      if (group.length > 1) {
        flags.push({
          id: `dup-${key}`,
          type: 'duplicate_payment',
          severity: 'high',
          description: `${group.length} duplicate payments of ${formatCurrency(group[0].payment)} for client ${group[0].clientName} on ${group[0].date}`,
          clientId: group[0].clientId,
          clientName: group[0].clientName,
          handlerCode: group[0].handlerCode,
          amount: group[0].payment * group.length,
          timestamp: group[0].date,
        });
      }
    });

    // 3. Cash-heavy handlers (>70% cash transactions)
    const handlerCashMap = new Map<string, { cash: number; total: number }>();
    fyPayments.forEach(p => {
      const entry = handlerCashMap.get(p.handlerCode) || { cash: 0, total: 0 };
      entry.total++;
      if ((p.paymentMode || 'cash') === 'cash') entry.cash++;
      handlerCashMap.set(p.handlerCode, entry);
    });
    handlerCashMap.forEach((stats, code) => {
      if (stats.total >= 5 && stats.cash / stats.total > 0.7) {
        const handler = handlers.find(h => h.code === code);
        flags.push({
          id: `cash-${code}`,
          type: 'cash_heavy',
          severity: 'medium',
          description: `Handler ${handler?.name || code} has ${((stats.cash / stats.total) * 100).toFixed(0)}% cash transactions (${stats.cash}/${stats.total})`,
          handlerCode: code,
          timestamp: new Date().toISOString().slice(0, 10),
        });
      }
    });

    // 4. Frequent corrections (multiple payments for same client in same month)
    const clientMonthMap = new Map<string, number>();
    fyPayments.forEach(p => {
      const key = `${p.clientId}-${p.paidTermFrom}`;
      clientMonthMap.set(key, (clientMonthMap.get(key) || 0) + 1);
    });
    clientMonthMap.forEach((count, key) => {
      if (count > 2) {
        const [clientId] = key.split('-');
        const client = fyClients.find(c => c.clientId === clientId);
        flags.push({
          id: `freq-${key}`,
          type: 'frequent_correction',
          severity: 'medium',
          description: `${count} payment entries for client ${client?.name || clientId} in same period — possible corrections`,
          clientId,
          clientName: client?.name,
          handlerCode: client?.handlerCode,
          timestamp: new Date().toISOString().slice(0, 10),
        });
      }
    });

    return flags.sort((a, b) => {
      const sev = { high: 0, medium: 1, low: 2 };
      return sev[a.severity] - sev[b.severity];
    });
  }, [fyPayments, fyClients, handlers]);

  const typeIcons: Record<string, React.ReactNode> = {
    large_deviation: <TrendingDown className="w-4 h-4" />,
    frequent_correction: <AlertTriangle className="w-4 h-4" />,
    cash_heavy: <Banknote className="w-4 h-4" />,
    duplicate_payment: <Copy className="w-4 h-4" />,
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Admin access required</div>;

  const highCount = riskFlags.filter(f => f.severity === 'high').length;
  const medCount = riskFlags.filter(f => f.severity === 'medium').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Risk Detection Engine</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{riskFlags.length} anomalies detected — FY {currentFY}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="erp-kpi-card text-center">
          <p className="text-xs text-muted-foreground">High Risk</p>
          <p className="text-2xl font-bold erp-mono text-destructive">{highCount}</p>
        </div>
        <div className="erp-kpi-card text-center">
          <p className="text-xs text-muted-foreground">Medium Risk</p>
          <p className="text-2xl font-bold erp-mono text-[hsl(var(--warning))]">{medCount}</p>
        </div>
        <div className="erp-kpi-card text-center">
          <p className="text-xs text-muted-foreground">Total Flags</p>
          <p className="text-2xl font-bold erp-mono">{riskFlags.length}</p>
        </div>
      </div>

      <div className="space-y-2">
        {riskFlags.length === 0 && (
          <div className="erp-kpi-card text-center py-12">
            <ShieldAlert className="w-8 h-8 mx-auto text-[hsl(var(--success))] mb-2" />
            <p className="text-sm text-muted-foreground">No anomalies detected — system is clean ✓</p>
          </div>
        )}
        {riskFlags.map(flag => (
          <div key={flag.id} className={`erp-kpi-card flex items-start gap-3 ${flag.severity === 'high' ? 'border-destructive/40 bg-destructive/5' : flag.severity === 'medium' ? 'border-[hsl(var(--warning)/0.4)]' : ''}`}>
            <div className={`p-2 rounded-sm ${flag.severity === 'high' ? 'bg-destructive/10 text-destructive' : 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]'}`}>
              {typeIcons[flag.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={flag.severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {flag.severity.toUpperCase()}
                </Badge>
                <span className="text-[10px] erp-mono text-muted-foreground">{flag.type.replace(/_/g, ' ')}</span>
                {flag.handlerCode && <span className="text-[10px] erp-mono text-muted-foreground">• {flag.handlerCode}</span>}
              </div>
              <p className="text-sm">{flag.description}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{flag.timestamp}</p>
            </div>
            {flag.amount && (
              <div className="text-right">
                <p className="erp-mono text-sm font-bold">{formatCurrency(flag.amount)}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
