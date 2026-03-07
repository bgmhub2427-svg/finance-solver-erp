import React, { useState } from 'react';
import { miniAuth } from '@/lib/mini-supabase';
import { Building2, LogIn, UserPlus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

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
        toast({ title: 'Welcome back', description: 'Signed in successfully.' });
      } else {
        const { error } = await miniAuth.signUp(email.trim(), password);
        if (error) throw error;
        toast({ title: 'Account created', description: 'You are now signed in.' });
      }
    } catch (err: any) {
      toast({ title: 'Authentication Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-lg bg-card shadow-lg">
        <div className="text-center space-y-2">
          <Building2 className="w-10 h-10 mx-auto text-primary" />
          <h1 className="text-xl font-bold tracking-tight">Enterprise ERP</h1>
          <p className="text-xs text-muted-foreground">Kota Associates — The Finance Solver</p>
          <p className="text-xs text-muted-foreground">{isLogin ? 'Sign In' : 'Create Account'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Password</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>

        <div className="border-t pt-3 space-y-1">
          <div className="flex items-center gap-1 justify-center">
            <Shield className="w-3 h-3 text-primary" />
            <p className="text-[10px] text-muted-foreground font-semibold">Admin Accounts</p>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Handlers: Use credentials provided by admin
          </p>
        </div>
      </div>
    </div>
  );
}
