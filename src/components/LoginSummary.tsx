import { useState, useEffect } from 'react';
import { miniDB } from '@/lib/mini-supabase';
import { useOrg } from '@/hooks/useOrg';
import { useAuth } from '@/hooks/useAuth';
import { Users, IndianRupee, FileText, TrendingUp } from 'lucide-react';
import kaLogo from '@/assets/kota-associates-logo.png';

interface Props {
  onComplete: () => void;
}

interface QuickStats {
  totalClients: number;
  totalPayments: number;
  totalInvoices: number;
  totalCollected: number;
}

export default function LoginSummary({ onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<QuickStats>({ totalClients: 0, totalPayments: 0, totalInvoices: 0, totalCollected: 0 });
  const { org } = useOrg();
  const { user, role } = useAuth();

  useEffect(() => {
    // Load quick stats
    (async () => {
      try {
        const [{ data: clients }, { data: payments }, { data: invoices }] = await Promise.all([
          miniDB.from('clients').select('*'),
          miniDB.from('payments').select('*'),
          miniDB.from('invoices').select('*'),
        ]);
        const totalCollected = (payments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        setStats({
          totalClients: clients?.length || 0,
          totalPayments: payments?.length || 0,
          totalInvoices: invoices?.length || 0,
          totalCollected,
        });
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = Math.min(100, prev + 5);
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 300);
        }
        return next;
      });
    }, 20);
    return () => clearInterval(interval);
  }, [onComplete]);

  const formatCurrency = (n: number) => {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full bg-primary/5 blur-3xl -top-20 -left-20 animate-pulse" />
        <div className="absolute w-80 h-80 rounded-full bg-accent/5 blur-3xl -bottom-20 -right-20 animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-4 w-full max-w-md">
        {/* Logo */}
        <img
          src={kaLogo}
          alt="Kota Associates"
          className="w-20 h-20 rounded-2xl shadow-2xl object-contain"
          style={{ animation: 'float 3s ease-in-out infinite' }}
        />

        {/* Welcome */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold gradient-text">Welcome Back</h1>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          {org && (
            <p className="text-sm font-semibold text-foreground/80">{org.name}</p>
          )}
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-mono">
            {role?.replace('_', ' ')} • Finance Solver F.S.001
          </p>
        </div>

        {/* Finance Summary Cards */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-center space-y-1">
            <Users className="w-5 h-5 mx-auto text-primary/70" />
            <p className="erp-mono text-xl font-bold">{stats.totalClients}</p>
            <p className="text-[10px] text-muted-foreground">Active Clients</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-center space-y-1">
            <IndianRupee className="w-5 h-5 mx-auto text-primary/70" />
            <p className="erp-mono text-xl font-bold">{formatCurrency(stats.totalCollected)}</p>
            <p className="text-[10px] text-muted-foreground">Collected</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-center space-y-1">
            <TrendingUp className="w-5 h-5 mx-auto text-primary/70" />
            <p className="erp-mono text-xl font-bold">{stats.totalPayments}</p>
            <p className="text-[10px] text-muted-foreground">Payments</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-center space-y-1">
            <FileText className="w-5 h-5 mx-auto text-primary/70" />
            <p className="erp-mono text-xl font-bold">{stats.totalInvoices}</p>
            <p className="text-[10px] text-muted-foreground">Invoices</p>
          </div>
        </div>

        {/* Progress */}
        <div className="w-full space-y-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    </div>
  );
}
