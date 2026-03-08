import React, { useState } from 'react';
import { miniAuth } from '@/lib/mini-supabase';
import { LogIn, UserPlus, Shield, Eye, EyeOff, Check, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { playClick, playSuccess, playError } from '@/lib/sound-engine';
import { validatePassword } from '@/lib/org-types';
import kaLogo from '@/assets/kota-associates-logo.png';

export default function Auth() {
  const [mode, setMode] = useState<'choose' | 'signin' | 'signup'>('choose');
  const isLogin = mode === 'signin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const pwCheck = validatePassword(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    if (!isLogin && !pwCheck.valid) {
      playError();
      toast({ title: 'Weak Password', description: pwCheck.errors.join(', '), variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await miniAuth.signIn(email.trim(), password);
        if (error) throw error;
        playSuccess();
        toast({ title: 'Welcome back', description: 'Signed in successfully.' });
      } else {
        const { error } = await miniAuth.signUp(email.trim(), password);
        if (error) throw error;
        playSuccess();
        toast({ title: 'Account created', description: 'Let\'s set up your organization.' });
      }
    } catch (err: any) {
      playError();
      toast({ title: 'Authentication Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setMode('choose');
    setEmail('');
    setPassword('');
    setShowPw(false);
    playClick();
  };

  return (
    <div className="min-h-screen flex items-center justify-center auth-bg relative overflow-hidden">
      <div className="auth-orb w-72 h-72 bg-primary/20 top-[-10%] left-[-5%]" style={{ animationDelay: '0s' }} />
      <div className="auth-orb w-96 h-96 bg-accent/15 bottom-[-15%] right-[-10%]" style={{ animationDelay: '3s' }} />
      <div className="auth-orb w-48 h-48 bg-primary/10 top-[40%] right-[10%]" style={{ animationDelay: '5s' }} />
      <div className="absolute inset-0 dot-grid opacity-40" />

      <div className="relative z-10 w-full max-w-[420px] perspective-container px-4">
        <div className="auth-card glass-strong rounded-2xl p-8 space-y-7">
          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="relative inline-block">
              <img src={kaLogo} alt="Kota Associates" className="w-20 h-20 mx-auto rounded-2xl shadow-lg object-contain animate-float" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight gradient-text">Finance Solver</h1>
              <p className="text-[11px] font-semibold tracking-[0.25em] text-muted-foreground mt-0.5">F.S.001</p>
              <p className="text-xs text-muted-foreground mt-1">Enterprise ERP Platform — Multi-Organization</p>
            </div>
          </div>

          {/* Choose mode */}
          {mode === 'choose' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground/80 text-center">Get started with Finance Solver</p>
              <Button
                className="w-full h-12 gap-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-lg hover:shadow-xl transition-all"
                onClick={() => { setMode('signin'); playClick(); }}
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 gap-2.5 rounded-xl text-sm font-semibold border-primary/30 hover:bg-primary/5 transition-all"
                onClick={() => { setMode('signup'); playClick(); }}
              >
                <UserPlus className="w-4 h-4" />
                Create New Account
              </Button>
            </div>
          )}

          {/* Auth form */}
          {mode !== 'choose' && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-medium text-foreground/80">
                  {isLogin ? 'Welcome Back' : 'Create Your Organization'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="your@email.com"
                    className="h-11 rounded-xl bg-background/50 border-border/60 focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <div className="relative">
                    <Input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      minLength={8}
                      className="h-11 rounded-xl bg-background/50 border-border/60 focus:border-primary transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {!isLogin && password.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(i => {
                          const passed = 5 - pwCheck.errors.length;
                          return (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                i < passed
                                  ? passed >= 4 ? 'bg-[hsl(var(--success))]' : passed >= 2 ? 'bg-[hsl(var(--warning))]' : 'bg-[hsl(var(--destructive))]'
                                  : 'bg-muted'
                              }`}
                            />
                          );
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
                            {rule.ok
                              ? <Check className="w-3 h-3 text-[hsl(var(--success))]" />
                              : <X className="w-3 h-3 text-muted-foreground/40" />}
                            <span className={`text-[10px] ${rule.ok ? 'text-[hsl(var(--success))]' : 'text-muted-foreground/60'}`}>
                              {rule.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 gap-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-lg hover:shadow-xl transition-all"
                  disabled={loading || (!isLogin && !pwCheck.valid)}
                  onClick={() => playClick()}
                >
                  {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
                </Button>
              </form>

              <p className="text-center text-xs text-muted-foreground">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button onClick={() => { setMode(isLogin ? 'signup' : 'signin'); playClick(); }} className="text-primary hover:underline font-semibold">
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </>
          )}

          <div className="border-t border-border/40 pt-4 space-y-1">
            <div className="flex items-center gap-1.5 justify-center">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] text-muted-foreground font-semibold">Strong Password Required</p>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Min 8 chars with uppercase, lowercase, number &amp; special character
            </p>
            <p className="text-[9px] text-muted-foreground/40 text-center mt-2">
              Finance Solver — F.S.001 • Created by Kota Associates
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
