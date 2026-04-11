import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { miniAuth } from '@/lib/mini-supabase';
import type { MiniUser } from '@/lib/mini-supabase';

export type UserRole = 'admin' | 'manager' | 'handler' | 'viewer' | 'fee_collector';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole | 'none' | null;
}

type Session = { user: MiniUser } | null;

interface AuthCtx {
  user: AuthUser | null;
  session: Session;
  loading: boolean;
  role: UserRole | 'none' | null;
  isAdmin: boolean;
  isViewer: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  role: null,
  isAdmin: false,
  isViewer: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = miniAuth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    miniAuth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await miniAuth.signOut();
  };

  const role = session?.user?.role || null;

  const authUser: AuthUser | null = session?.user
    ? { id: session.user.id, email: session.user.email, role }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user: authUser,
        session,
        loading,
        role,
        isAdmin: role === 'admin' || role === 'manager',
        isViewer: role === 'viewer',
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
