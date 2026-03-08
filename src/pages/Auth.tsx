import React, { useState } from 'react';
import { miniAuth } from '@/lib/mini-supabase';
import { Building2, LogIn, UserPlus, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { playClick, playSuccess, playError } from '@/lib/sound-engine';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
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
        toast({ title: 'Account created', description: 'You are now signed in.' });
      }
    } catch (err: any) {
      playError();
      toast({ title: 'Authentication Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center auth-bg relative overflow-hidden">
      {/* Floating orbs */}
      <div className="auth-orb w-72 h-72 bg-primary/20 top-[-10%] left-[-5%]" style={{ animationDelay: '0s' }} />
      <div className="auth-orb w-96 h-96 bg-accent/15 bottom-[-15%] right-[-10%]" style={{ animationDelay: '3s' }} />
      <div className="auth-orb w-48 h-48 bg-primary/10 top-[40%] right-[10%]" style={{ animationDelay: '5s' }} />

      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-40" />

      <div className="relative z-10 w-full max-w-[420px] perspective-container px-4">
        <div className="auth-card glass-strong rounded-2xl p-8 space-y-7">
          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="relative inline-block">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-float shadow-lg">
                <Building2 className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center animate-glow">
                <Sparkles className="w-3 h-3 text-accent-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight gradient-text">Finance Solver</h1>
              <p className="text-xs text-muted-foreground mt-1">Kota Associates — Enterprise ERP</p>
            </div>
            <p className="text-sm font-medium text-foreground/80">{isLogin ? 'Welcome Back' : 'Create Account'}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="h-11 rounded-xl bg-background/50 border-border/60 focus:border-primary transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
                className="h-11 rounded-xl bg-background/50 border-border/60 focus:border-primary transition-all"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 gap-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 shadow-lg hover:shadow-xl transition-all"
              disabled={loading}
              onClick={() => playClick()}
            >
              {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button onClick={() => { setIsLogin(!isLogin); playClick(); }} className="text-primary hover:underline font-semibold">
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>

          <div className="border-t border-border/40 pt-4 space-y-1">
            <div className="flex items-center gap-1.5 justify-center">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] text-muted-foreground font-semibold">Admin Accounts</p>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Handlers: Use credentials provided by admin
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
