import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { miniAuth, miniDB } from '@/lib/mini-supabase';
import type { MiniUser } from '@/lib/mini-supabase';

export type UserRole = 'admin' | 'manager' | 'handler' | 'viewer' | 'fee_collector';
type AppRole = UserRole | 'none' | null;

type Session = { user: MiniUser } | null;

export type AuthUser = MiniUser & {
  role: AppRole;
  handler_id: string | null;
};

interface AuthCtx {
  user: AuthUser | null;
  session: Session;
  loading: boolean;
  role: AppRole;
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
  const [role, setRole] = useState<AppRole>(null);
  const [handlerCode, setHandlerCode] = useState<string | null>(null);
  const [handlerId, setHandlerId] = useState<string | null>(null);

  const fetchRoleInfo = async () => {
    try {
      await miniDB.rpc('assign_role_on_signup');

      const { data: roleData } = await miniDB.rpc('get_my_role');
      const nextRole = (roleData as AppRole) || 'none';
      setRole(nextRole);

      if (nextRole === 'handler') {
        const [{ data: hCode }, { data: hId }] = await Promise.all([
          miniDB.rpc('get_my_handler_code'),
          miniDB.rpc('get_my_handler_id'),
        ]);
        setHandlerCode((hCode as string) || null);
        setHandlerId((hId as string) || null);
      } else {
        setHandlerCode(null);
        setHandlerId(null);
      }
    } catch (err) {
      console.error('Error fetching role:', err);
      setRole('none');
      setHandlerCode(null);
      setHandlerId(null);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = miniAuth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        await fetchRoleInfo();
      } else {
        setRole(null);
        setHandlerCode(null);
        setHandlerId(null);
      }
      setLoading(false);
    });

    miniAuth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession?.user) {
        await fetchRoleInfo();
      }
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    setRole(null);
    setHandlerCode(null);
    setHandlerId(null);
    await miniAuth.signOut();
  };

  const authUser: AuthUser | null = session?.user
    ? {
        ...session.user,
        role: role as AppRole,
        handler_id: role === 'handler' ? handlerId : null,
      } as AuthUser
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
