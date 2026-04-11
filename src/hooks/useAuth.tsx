import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { miniAuth, miniDB } from '@/lib/mini-supabase';
import type { MiniUser } from '@/lib/mini-supabase';

export type UserRole = 'admin' | 'manager' | 'handler' | 'viewer' | 'fee_collector';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole | 'none' | null;
  handler_id: string | null;
}

type Session = { user: MiniUser } | null;

interface AuthCtx {
  user: AuthUser | null;
  session: Session;
  loading: boolean;
  role: UserRole | 'none' | null;
  handlerCode: string | null;
  isAdmin: boolean;
  isViewer: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  role: null,
  handlerCode: null,
  isAdmin: false,
  isViewer: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);
  const [handlerCode, setHandlerCode] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = miniAuth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.role === 'handler') {
        try {
          const { data } = await miniDB.from('handlers').select('*');
          const h = (data || []).find((h: any) => h.user_id === nextSession.user.id);
          setHandlerCode(h?.code || null);
        } catch { setHandlerCode(null); }
      } else {
        setHandlerCode(null);
      }
      setLoading(false);
    });

    miniAuth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.role === 'handler') {
        try {
          const { data } = await miniDB.from('handlers').select('*');
          const h = (data || []).find((h: any) => h.user_id === s.user.id);
          setHandlerCode(h?.code || null);
        } catch { setHandlerCode(null); }
      }
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    setHandlerCode(null);
    await miniAuth.signOut();
  };

  const role = session?.user?.role || null;

  const authUser: AuthUser | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        role,
        handler_id: session.user.handler_id || null,
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user: authUser,
        session,
        loading,
        role,
        handlerCode,
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
