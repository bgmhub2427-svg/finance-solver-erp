import React, { useState, useEffect } from 'react';
import { miniAuth } from '@/lib/mini-supabase';
import { LogIn, UserPlus, Eye, EyeOff, Check, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { playClick, playSuccess, playError } from '@/lib/sound-engine';
import { validatePassword, deriveModules, defaultRoleLimits, type OrgConfig } from '@/lib/org-types';
import { useOrg } from '@/hooks/useOrg';
import kaLogo from '@/assets/kota-associates-logo.png';

type AuthStep = 'choose' | 'login' | 'signup';

export default function Auth() {
  const [step, setStep] = useState<AuthStep>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firmName, setFirmName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { createOrg, orgs } = useOrg();

  // One-time reset for fresh start
  useEffect(() => {
    const RESET_FLAG = 'erp_fresh_reset_v4';
    if (!localStorage.getItem(RESET_FLAG)) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('erp_') || key.startsWith('mini_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      try { indexedDB.deleteDatabase('erp_mini_supabase'); } catch {}
      localStorage.setItem(RESET_FLAG, 'done');
    }
  }, []);

  const pwCheck = validatePassword(password);

  const resetFields = () => {
    setEmail(''); setPassword(''); setShowPw(false); setFirmName('');
  };

  const goBack = () => {
    playClick();
    setStep('choose');
    resetFields();
  };

  // Direct login → Dashboard
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await miniAuth.signIn(email.trim(), password);
      if (error) throw error;
      playSuccess();
      toast({ title: 'Welcome back!', description: 'Signed into Finance Solver ERP.' });
    } catch (err: any) {
      playError();
      toast({ title: 'Login Failed', description: err.message || 'Invalid email or password', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Single-step signup: create firm + admin user + auto-login
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwCheck.valid) {
      playError();
      toast({ title: 'Weak Password', description: pwCheck.errors.join(', '), variant: 'destructive' });
      return;
    }
    if (firmName.trim().length < 2) {
      playError();
      toast({ title: 'Invalid Firm Name', description: 'Firm name must be at least 2 characters.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const orgId = crypto.randomUUID?.() || `org-${Date.now()}`;
      const slug = firmName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
      const trimmedEmail = email.trim();

      // Default config for single-org setup
      const config: OrgConfig = {
        org_type: 'ca_firm',
        team_size: '1-5',
        billing_model: 'monthly',
        services: ['gst', 'itr', 'accounting'],
        roles: ['admin', 'manager', 'handler', 'viewer', 'fee_collector'],
        payment_structure: 'variable',
        enabled_modules: deriveModules({ org_type: 'ca_firm' } as Partial<OrgConfig>),
        role_limits: defaultRoleLimits('1-5'),
      };

      // Create organization record
      createOrg({
        id: orgId,
        name: firmName.trim(),
        slug,
        owner_id: orgId,
        owner_email: trimmedEmail,
        created_at: new Date().toISOString(),
        config,
        org_email: trimmedEmail,
        org_password: password,
      });

      // Create admin user + auto sign-in
      const signupRes = await miniAuth.signUp(trimmedEmail, password);
      if (signupRes.error) throw signupRes.error;

      if (signupRes.data?.user) {
        await miniAuth.updateUserOrgId(signupRes.data.user.id, orgId);
      }

      // Sign in immediately
      await miniAuth.signIn(trimmedEmail, password);

      playSuccess();
      toast({ title: 'Welcome to Finance Solver!', description: `${firmName.trim()} is ready.` });
    } catch (err: any) {
      playError();
      toast({ title: 'Signup Failed', description: err.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center auth-bg relative overflow-hidden">
      <div className="auth-orb w-72 h-72 bg-primary/20 top-[-10%] left-[-5%]" style={{ animationDelay: '0s' }} />
      <div className="auth-orb w-96 h-96 bg-accent/15 bottom-[-15%] right-[-10%]" style={{ animationDelay: '3s' }} />
      <div className="auth-orb w-48 h-48 bg-primary/10 top-[40%] right-[10%]" style={{ animationDelay: '5s' }} />
      <div className="absolute inset-0 dot-grid opacity-40" />

      <div className="relative z-10 w-full max-w-[440px] perspective-container px-4">
        <div className="auth-card glass-strong rounded-2xl p-8 space-y-6">
          {/* Logo */}
          <div className="text-center space-y-2">
            <img src={kaLogo} alt="Kota Associates" className="w-16 h-16 mx-auto rounded-2xl shadow-lg object-contain animate-float" />
            <h1 className="text-xl font-bold tracking-tight gradient-text">Finance Solver</h1>
            <p className="text-[10px] font-semibold tracking-[0.25em] text-muted-foreground">F.S.001 • Enterprise ERP</p>
          </div>

          {/* ── Choose ── */}
          {step === 'choose' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground/80 text-center">Get started with Finance Solver</p>
              <Button
                className="w-full h-12 gap-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-lg"
                onClick={() => { setStep('login'); playClick(); }}
              >
                <LogIn className="w-4 h-4" /> Sign In
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 gap-2.5 rounded-xl text-sm font-semibold border-primary/30 hover:bg-primary/5"
                onClick={() => { setStep('signup'); playClick(); }}
              >
                <UserPlus className="w-4 h-4" /> Create New Account
              </Button>
            </div>
          )}

          {/* ── Login ── */}
          {step === 'login' && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-medium text-foreground/80">Sign In to Your Account</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                    placeholder="admin@firm.com" className="h-11 rounded-xl bg-background/50 border-border/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <div className="relative">
                    <Input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      required placeholder="••••••••" className="h-11 rounded-xl bg-background/50 border-border/60 pr-10" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 gap-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-lg"
                  disabled={loading}>
                  <LogIn className="w-4 h-4" /> {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
              <p className="text-center text-xs text-muted-foreground">
                Don't have an account?{' '}
                <button onClick={() => { setStep('signup'); resetFields(); playClick(); }} className="text-primary hover:underline font-semibold">Sign Up</button>
              </p>
            </>
          )}

          {/* ── Signup: Single Step ── */}
          {step === 'signup' && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-medium text-foreground/80">Create Your Account</p>
              </div>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Firm Name</label>
                  <Input value={firmName} onChange={e => setFirmName(e.target.value)} required autoFocus
                    placeholder="e.g. Kota Associates" className="h-11 rounded-xl bg-background/50 border-border/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Admin Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="admin@firm.com" className="h-11 rounded-xl bg-background/50 border-border/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <div className="relative">
                    <Input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      required placeholder="••••••••" minLength={8} className="h-11 rounded-xl bg-background/50 border-border/60 pr-10" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(i => {
                          const passed = 5 - pwCheck.errors.length;
                          return <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                            i < passed ? passed >= 4 ? 'bg-[hsl(var(--success))]' : passed >= 2 ? 'bg-[hsl(var(--warning))]' : 'bg-[hsl(var(--destructive))]' : 'bg-muted'
                          }`} />;
                        })}
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { label: '8+ characters', ok: password.length >= 8 },
                          { label: 'Uppercase', ok: /[A-Z]/.test(password) },
                          { label: 'Lowercase', ok: /[a-z]/.test(password) },
                          { label: 'Number', ok: /[0-9]/.test(password) },
                          { label: 'Special char', ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
                        ].map(rule => (
                          <div key={rule.label} className="flex items-center gap-1">
                            {rule.ok ? <Check className="w-3 h-3 text-[hsl(var(--success))]" /> : <X className="w-3 h-3 text-muted-foreground/40" />}
                            <span className={`text-[10px] ${rule.ok ? 'text-[hsl(var(--success))]' : 'text-muted-foreground/60'}`}>{rule.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full h-11 gap-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-lg"
                  disabled={loading || !pwCheck.valid || firmName.trim().length < 2}>
                  <UserPlus className="w-4 h-4" /> {loading ? 'Creating Account...' : 'Create Account & Enter ERP'}
                </Button>
              </form>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{' '}
                <button onClick={() => { setStep('login'); resetFields(); playClick(); }} className="text-primary hover:underline font-semibold">Sign In</button>
              </p>
            </>
          )}

          {/* Footer */}
          <div className="text-center pt-2 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground">Finance Solver — F.S.001 • Created by Kota Associates</p>
          </div>
        </div>
      </div>
    </div>
  );
}
