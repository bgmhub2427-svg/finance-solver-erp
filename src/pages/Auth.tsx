import React, { useState } from 'react';
import { miniAuth } from '@/lib/mini-supabase';
import { mainAuth, type MainUser } from '@/lib/main-auth';
import { LogIn, UserPlus, Shield, Eye, EyeOff, Check, X, ArrowLeft, Building2, KeyRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { playClick, playSuccess, playError } from '@/lib/sound-engine';
import { validatePassword, type Organization } from '@/lib/org-types';
import { useOrg } from '@/hooks/useOrg';
import kaLogo from '@/assets/kota-associates-logo.png';

type AuthStep = 'choose' | 'main-login' | 'main-signup' | 'org-select' | 'org-auth' | 'org-user-login';

export default function Auth() {
  const [step, setStep] = useState<AuthStep>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mainUser, setMainUser] = useState<MainUser | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPassword, setOrgPassword] = useState('');
  const [orgUserEmail, setOrgUserEmail] = useState('');
  const [orgUserPassword, setOrgUserPassword] = useState('');
  const { toast } = useToast();
  const { orgs } = useOrg();

  const pwCheck = validatePassword(password);

  const resetFields = () => {
    setEmail(''); setPassword(''); setShowPw(false);
    setOrgEmail(''); setOrgPassword('');
    setOrgUserEmail(''); setOrgUserPassword('');
  };

  const goBack = () => {
    playClick();
    if (step === 'main-login' || step === 'main-signup') { setStep('choose'); resetFields(); }
    else if (step === 'org-select') { mainAuth.signOut(); setMainUser(null); setStep('choose'); resetFields(); }
    else if (step === 'org-auth') { setSelectedOrg(null); setOrgEmail(''); setOrgPassword(''); setStep('org-select'); }
    else if (step === 'org-user-login') { setOrgUserEmail(''); setOrgUserPassword(''); setStep('org-auth'); }
  };

  // Step 2: Main account login
  const handleMainLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = mainAuth.signIn(email.trim(), password);
    setLoading(false);
    if (error) { playError(); toast({ title: 'Login Failed', description: error, variant: 'destructive' }); return; }
    playSuccess();
    setMainUser(data);
    resetFields();
    setStep('org-select');
  };

  // Step 2: Main account signup
  const handleMainSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwCheck.valid) { playError(); toast({ title: 'Weak Password', description: pwCheck.errors.join(', '), variant: 'destructive' }); return; }
    setLoading(true);
    const { data, error } = mainAuth.signUp(email.trim(), password);
    setLoading(false);
    if (error) { playError(); toast({ title: 'Signup Failed', description: error, variant: 'destructive' }); return; }
    playSuccess();
    setMainUser(data);
    resetFields();
    // New user → go to org setup (handled by signup flow through miniAuth)
    // For now, create a temp org user account so OrgSetup works
    const tempPassword = 'Temp@' + Date.now();
    await miniAuth.signUp(data!.email, tempPassword);
    toast({ title: 'Account Created', description: "Let's set up your organization." });
  };

  // Step 3: Org selection
  const handleOrgSelect = (org: Organization) => {
    playClick();
    setSelectedOrg(org);
    setStep('org-auth');
  };

  // Step 4: Org credentials
  const handleOrgAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    if (
      orgEmail.trim().toLowerCase() === selectedOrg.org_email?.toLowerCase() &&
      orgPassword === selectedOrg.org_password
    ) {
      playSuccess();
      setOrgEmail(''); setOrgPassword('');
      setStep('org-user-login');
    } else {
      playError();
      toast({ title: 'Invalid Credentials', description: 'Organization email or password is incorrect.', variant: 'destructive' });
    }
  };

  // Step 5: Org user login
  const handleOrgUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await miniAuth.signIn(orgUserEmail.trim(), orgUserPassword);
      if (error) throw error;
      playSuccess();
      toast({ title: 'Welcome', description: `Signed into ${selectedOrg?.name || 'organization'}.` });
    } catch (err: any) {
      playError();
      toast({ title: 'Login Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Get orgs linked to main user
  const linkedOrgs = mainUser
    ? orgs.filter(o => mainUser.linked_org_ids.includes(o.id))
    : [];

  const stepTitle: Record<AuthStep, string> = {
    'choose': '',
    'main-login': 'Sign In to Your Account',
    'main-signup': 'Create Your Account',
    'org-select': 'Select Organization',
    'org-auth': `Authenticate: ${selectedOrg?.name || ''}`,
    'org-user-login': `Login to ${selectedOrg?.name || ''}`,
  };

  const stepNumber = step === 'choose' ? 0 : step === 'main-login' || step === 'main-signup' ? 1 : step === 'org-select' ? 2 : step === 'org-auth' ? 3 : 4;

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

          {/* Step indicator */}
          {stepNumber > 0 && (
            <div className="flex items-center gap-1.5 justify-center">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${
                  s <= stepNumber ? 'w-8 bg-primary' : 'w-4 bg-muted'
                }`} />
              ))}
              <span className="text-[10px] text-muted-foreground ml-2">Step {stepNumber}/4</span>
            </div>
          )}

          {/* ── Step 1: Choose ── */}
          {step === 'choose' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground/80 text-center">Get started with Finance Solver</p>
              <Button
                className="w-full h-12 gap-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-lg"
                onClick={() => { setStep('main-login'); playClick(); }}
              >
                <LogIn className="w-4 h-4" /> Sign In
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 gap-2.5 rounded-xl text-sm font-semibold border-primary/30 hover:bg-primary/5"
                onClick={() => { setStep('main-signup'); playClick(); }}
              >
                <UserPlus className="w-4 h-4" /> Create New Account
              </Button>
            </div>
          )}

          {/* ── Step 2a: Main Login ── */}
          {step === 'main-login' && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-medium text-foreground/80">{stepTitle[step]}</p>
              </div>
              <form onSubmit={handleMainLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                    placeholder="your@email.com" className="h-11 rounded-xl bg-background/50 border-border/60" />
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
                <button onClick={() => { setStep('main-signup'); resetFields(); playClick(); }} className="text-primary hover:underline font-semibold">Sign Up</button>
              </p>
            </>
          )}

          {/* ── Step 2b: Main Signup ── */}
          {step === 'main-signup' && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-medium text-foreground/80">{stepTitle[step]}</p>
              </div>
              <form onSubmit={handleMainSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                    placeholder="your@email.com" className="h-11 rounded-xl bg-background/50 border-border/60" />
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
                  disabled={loading || !pwCheck.valid}>
                  <UserPlus className="w-4 h-4" /> {loading ? 'Creating...' : 'Create Account'}
                </Button>
              </form>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{' '}
                <button onClick={() => { setStep('main-login'); resetFields(); playClick(); }} className="text-primary hover:underline font-semibold">Sign In</button>
              </p>
            </>
          )}

          {/* ── Step 3: Org Selection ── */}
          {step === 'org-select' && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <p className="text-sm font-medium text-foreground/80">Select Organization</p>
                  <p className="text-[10px] text-muted-foreground">Logged in as {mainUser?.email}</p>
                </div>
              </div>

              {linkedOrgs.length > 0 ? (
                <div className="space-y-2">
                  {linkedOrgs.map(org => (
                    <button key={org.id} onClick={() => handleOrgSelect(org)}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{org.name}</p>
                        <p className="text-[10px] text-muted-foreground">{org.config?.org_type || 'Organization'}</p>
                      </div>
                      <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <Building2 className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No organizations linked to your account yet.</p>
                  <p className="text-xs text-muted-foreground/60">Create a new organization to get started.</p>
                </div>
              )}

              <Button variant="outline" className="w-full h-11 gap-2 rounded-xl text-sm font-semibold border-primary/30 hover:bg-primary/5"
                onClick={async () => {
                  playClick();
                  // Create a temp miniAuth account for signup flow → OrgSetup
                  const tempPw = 'Temp@' + Date.now() + 'x';
                  await miniAuth.signUp(mainUser!.email, tempPw);
                  toast({ title: 'New Organization', description: 'Complete the setup wizard to create your organization.' });
                }}>
                <Building2 className="w-4 h-4" /> Create New Organization
              </Button>
            </>
          )}

          {/* ── Step 4: Org Credentials ── */}
          {step === 'org-auth' && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <p className="text-sm font-medium text-foreground/80">Organization Authentication</p>
                  <p className="text-[10px] text-muted-foreground">{selectedOrg?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <KeyRound className="w-4 h-4 text-primary shrink-0" />
                <p className="text-[11px] text-foreground/70">Enter the organization credentials to verify your access.</p>
              </div>

              <form onSubmit={handleOrgAuth} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Organization Email</label>
                  <Input type="email" value={orgEmail} onChange={e => setOrgEmail(e.target.value)} required autoFocus
                    placeholder="org@company.com" className="h-11 rounded-xl bg-background/50 border-border/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Organization Password</label>
                  <Input type="password" value={orgPassword} onChange={e => setOrgPassword(e.target.value)} required
                    placeholder="••••••••" className="h-11 rounded-xl bg-background/50 border-border/60" />
                </div>
                <Button type="submit" className="w-full h-11 gap-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-lg">
                  <Shield className="w-4 h-4" /> Verify Access
                </Button>
              </form>
            </>
          )}

          {/* ── Step 5: Org User Login ── */}
          {step === 'org-user-login' && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <p className="text-sm font-medium text-foreground/80">User Login</p>
                  <p className="text-[10px] text-muted-foreground">{selectedOrg?.name} • Enter your role-based credentials</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <Users className="w-4 h-4 text-accent shrink-0" />
                <p className="text-[11px] text-foreground/70">Login with your assigned user account (Admin, Handler, etc.)</p>
              </div>

              <form onSubmit={handleOrgUserLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">User Email</label>
                  <Input type="email" value={orgUserEmail} onChange={e => setOrgUserEmail(e.target.value)} required autoFocus
                    placeholder="admin@company.com" className="h-11 rounded-xl bg-background/50 border-border/60" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">User Password</label>
                  <div className="relative">
                    <Input type={showPw ? 'text' : 'password'} value={orgUserPassword} onChange={e => setOrgUserPassword(e.target.value)}
                      required placeholder="••••••••" className="h-11 rounded-xl bg-background/50 border-border/60 pr-10" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 gap-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-lg"
                  disabled={loading}>
                  <LogIn className="w-4 h-4" /> {loading ? 'Signing in...' : 'Enter ERP System'}
                </Button>
              </form>
            </>
          )}

          {/* Footer */}
          <div className="border-t border-border/40 pt-3 space-y-1">
            <div className="flex items-center gap-1.5 justify-center">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] text-muted-foreground font-semibold">3-Level Secure Access</p>
            </div>
            <p className="text-[9px] text-muted-foreground/40 text-center">
              Finance Solver — F.S.001 • Created by Kota Associates
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
