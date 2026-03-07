import React, { useMemo, useState } from 'react';
import { useERP } from '@/lib/erp-store';
import { useAuth } from '@/hooks/useAuth';
import { Brain, MapPin, Bell, Calendar, TrendingUp, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

interface ClientScore {
  clientId: string;
  name: string;
  handlerCode: string;
  totalPending: number;
  paymentHistory: number;
  avgDelay: number;
  preferredMethod: string;
  successRate: number;
  probability: number;
  dueAge: number;
  followUpLevel: 'none' | '30day' | '60day' | '90day';
}

export default function AIPlanner() {
  const { clients, payments, handlers, currentFY } = useERP();
  const { isAdmin, handlerCode } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'planner' | 'followup' | 'route'>('planner');

  const fyClients = useMemo(() => clients.filter(c => c.financialYear === currentFY), [clients, currentFY]);
  const fyPayments = useMemo(() => payments.filter(p => p.financialYear === currentFY), [payments, currentFY]);

  const scoredClients = useMemo<ClientScore[]>(() => {
    return fyClients.map(c => {
      const clientPayments = fyPayments.filter(p => p.clientId === c.clientId);
      const paymentCount = clientPayments.length;
      const totalPaid = clientPayments.reduce((s, p) => s + p.payment, 0);
      const totalDue = c.oldFeeDue + c.newFeeDue;

      // Success rate: % of due paid
      const successRate = totalDue > 0 ? Math.min(100, (totalPaid / totalDue) * 100) : 0;

      // Average delay (simple: based on payment count vs months elapsed)
      const monthsInFY = new Date().getMonth() >= 3 ? new Date().getMonth() - 2 : new Date().getMonth() + 10;
      const expectedPayments = Math.max(1, monthsInFY);
      const avgDelay = Math.max(0, (expectedPayments - paymentCount) * 15); // days

      // Preferred method
      const methodMap = new Map<string, number>();
      clientPayments.forEach(p => {
        const mode = p.paymentMode || 'cash';
        methodMap.set(mode, (methodMap.get(mode) || 0) + 1);
      });
      let preferredMethod = 'cash';
      let maxCount = 0;
      methodMap.forEach((count, mode) => { if (count > maxCount) { maxCount = count; preferredMethod = mode; } });

      // Probability score
      let probability = 50;
      if (successRate > 80) probability += 30;
      else if (successRate > 50) probability += 15;
      else if (successRate > 20) probability += 5;
      if (paymentCount > 3) probability += 10;
      if (avgDelay < 15) probability += 10;
      else if (avgDelay > 45) probability -= 15;
      if (c.totalPending <= 0) probability = 95;
      probability = Math.min(99, Math.max(5, probability));

      // Due age (days since last payment or FY start)
      const lastPayment = clientPayments.sort((a, b) => b.date.localeCompare(a.date))[0];
      const lastDate = lastPayment ? new Date(lastPayment.date) : new Date(currentFY.split('-')[0] + '-04-01');
      const dueAge = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      let followUpLevel: ClientScore['followUpLevel'] = 'none';
      if (c.totalPending > 0) {
        if (dueAge > 90) followUpLevel = '90day';
        else if (dueAge > 60) followUpLevel = '60day';
        else if (dueAge > 30) followUpLevel = '30day';
      }

      return {
        clientId: c.clientId,
        name: c.name,
        handlerCode: c.handlerCode,
        totalPending: c.totalPending,
        paymentHistory: paymentCount,
        avgDelay,
        preferredMethod,
        successRate: Math.round(successRate),
        probability,
        dueAge,
        followUpLevel,
      };
    })
    .filter(c => c.totalPending > 0)
    .sort((a, b) => b.probability - a.probability);
  }, [fyClients, fyPayments, currentFY]);

  const bestToVisit = scoredClients.filter(c => c.probability >= 60).slice(0, 10);
  const followUps30 = scoredClients.filter(c => c.followUpLevel === '30day');
  const followUps60 = scoredClients.filter(c => c.followUpLevel === '60day');
  const followUps90 = scoredClients.filter(c => c.followUpLevel === '90day');

  const handleAction = (action: string, client: ClientScore) => {
    toast({ title: `${action} — ${client.name}`, description: `Action recorded for ${client.clientId}` });
  };

  const tabs = [
    { key: 'planner', label: 'Collection Planner', icon: Brain },
    { key: 'followup', label: 'Follow-Up System', icon: Bell },
    { key: 'route', label: 'Route Planning', icon: MapPin },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="erp-page-title flex items-center gap-2"><Brain className="w-5 h-5" /> AI Collection Planner</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Smart collection planning powered by payment analytics — FY {currentFY}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'planner' && (
        <>
          {/* Best Clients */}
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[hsl(var(--success))]" /> Best Clients to Visit Today</h2>
            <div className="grid grid-cols-2 gap-3">
              {bestToVisit.map(c => (
                <div key={c.clientId} className="erp-kpi-card flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold erp-mono ${c.probability >= 80 ? 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]' : 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]'}`}>
                    {c.probability}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground erp-mono">{c.clientId} • {c.handlerCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="erp-mono text-sm font-bold text-destructive">{formatCurrency(c.totalPending)}</p>
                    <p className="text-[10px] text-muted-foreground">Prefers: {c.preferredMethod.toUpperCase()}</p>
                  </div>
                </div>
              ))}
              {bestToVisit.length === 0 && (
                <div className="col-span-2 erp-kpi-card text-center py-8 text-muted-foreground text-sm">No high-probability clients found</div>
              )}
            </div>
          </div>

          {/* Full Scoring Table */}
          <div className="erp-kpi-card p-0 overflow-auto">
            <div className="px-4 py-3 border-b bg-muted/50"><h2 className="text-sm font-semibold">Payment Probability Scores</h2></div>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Handler</th>
                  <th>Probability</th>
                  <th>Success Rate</th>
                  <th>Avg Delay</th>
                  <th>Preferred Method</th>
                  <th className="text-right">Pending</th>
                  <th>History</th>
                </tr>
              </thead>
              <tbody>
                {scoredClients.slice(0, 30).map(c => (
                  <tr key={c.clientId}>
                    <td>
                      <p className="text-xs font-medium">{c.name}</p>
                      <p className="text-[10px] erp-mono text-muted-foreground">{c.clientId}</p>
                    </td>
                    <td className="erp-mono text-xs">{c.handlerCode}</td>
                    <td>
                      <Badge variant={c.probability >= 70 ? 'default' : c.probability >= 40 ? 'secondary' : 'destructive'} className="erp-mono text-xs">
                        {c.probability}%
                      </Badge>
                    </td>
                    <td className="erp-mono text-xs">{c.successRate}%</td>
                    <td className="erp-mono text-xs">{c.avgDelay}d</td>
                    <td className="text-xs uppercase">{c.preferredMethod}</td>
                    <td className="erp-mono text-xs text-right font-bold">{formatCurrency(c.totalPending)}</td>
                    <td className="erp-mono text-xs">{c.paymentHistory} txn</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'followup' && (
        <div className="space-y-4">
          {[
            { label: 'Overdue > 90 Days', items: followUps90, color: 'text-destructive', bg: 'bg-destructive/5' },
            { label: 'Overdue > 60 Days', items: followUps60, color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning)/0.05)]' },
            { label: 'Overdue > 30 Days', items: followUps30, color: 'text-[hsl(var(--info))]', bg: 'bg-[hsl(var(--info)/0.05)]' },
          ].map(group => (
            <div key={group.label}>
              <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${group.color}`}>
                <Clock className="w-4 h-4" /> {group.label} ({group.items.length})
              </h3>
              <div className="space-y-2">
                {group.items.map(c => (
                  <div key={c.clientId} className={`erp-kpi-card flex items-center gap-3 ${group.bg}`}>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-[10px] erp-mono text-muted-foreground">{c.clientId} • Due: {c.dueAge} days • Handler: {c.handlerCode}</p>
                    </div>
                    <p className="erp-mono text-sm font-bold text-destructive">{formatCurrency(c.totalPending)}</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAction('Send Reminder', c)}>Remind</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAction('Schedule Visit', c)}>Visit</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleAction('Mark Follow-up', c)}>Follow-up</Button>
                    </div>
                  </div>
                ))}
                {group.items.length === 0 && <p className="text-xs text-muted-foreground py-2">No clients in this category</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'route' && (
        <div className="space-y-4">
          <div className="erp-kpi-card text-center py-8">
            <MapPin className="w-8 h-8 mx-auto text-[hsl(var(--info))] mb-3" />
            <h3 className="text-sm font-semibold mb-1">Smart Route Planning</h3>
            <p className="text-xs text-muted-foreground mb-4">Optimized collection routes based on client proximity and payment probability</p>
            <Button size="sm" onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => toast({ title: 'Location acquired', description: `Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}` }),
                  () => toast({ title: 'Location unavailable', description: 'Please enable location services', variant: 'destructive' })
                );
              } else {
                toast({ title: 'Geolocation not supported', variant: 'destructive' });
              }
            }}>
              <MapPin className="w-3.5 h-3.5 mr-1" /> Get My Location
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Recommended Visit Order (by probability)</h3>
            <div className="space-y-1">
              {bestToVisit.map((c, i) => (
                <div key={c.clientId} className="erp-kpi-card flex items-center gap-3 py-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-[10px] erp-mono text-muted-foreground">{c.clientId}</p>
                  </div>
                  <Badge className="erp-mono text-xs">{c.probability}%</Badge>
                  <span className="erp-mono text-sm font-bold text-destructive">{formatCurrency(c.totalPending)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
