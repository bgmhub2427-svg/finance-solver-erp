// Main user accounts - top-level identity layer (Level 1)
import { validatePassword } from '@/lib/org-types';
import { loadDB } from '@/lib/mini-supabase/mini-db';

export interface MainUser {
  id: string;
  email: string;
  password: string;
  linked_org_ids: string[];
  created_at: string;
}

const MAIN_USERS_KEY = 'erp_main_users';
const MAIN_SESSION_KEY = 'erp_main_session';

function genId(): string {
  return crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function loadMainUsers(): MainUser[] {
  try {
    const raw = localStorage.getItem(MAIN_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMainUsers(users: MainUser[]) {
  localStorage.setItem(MAIN_USERS_KEY, JSON.stringify(users));
}

export function getMainSession(): MainUser | null {
  try {
    const raw = localStorage.getItem(MAIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setMainSession(user: MainUser | null) {
  if (user) {
    localStorage.setItem(MAIN_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(MAIN_SESSION_KEY);
  }
}

export const mainAuth = {
  signIn(email: string, password: string): { data: MainUser | null; error: string | null } {
    const users = loadMainUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) return { data: null, error: 'Invalid email or password' };
    setMainSession(user);
    return { data: user, error: null };
  },

  signUp(email: string, password: string): { data: MainUser | null; error: string | null } {
    const { valid, errors } = validatePassword(password);
    if (!valid) return { data: null, error: `Weak password: ${errors.join(', ')}` };

    const users = loadMainUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { data: null, error: 'An account with this email already exists' };
    }

    const user: MainUser = {
      id: genId(),
      email,
      password,
      linked_org_ids: [],
      created_at: new Date().toISOString(),
    };
    users.push(user);
    saveMainUsers(users);
    setMainSession(user);
    return { data: user, error: null };
  },

  signOut() {
    setMainSession(null);
  },

  getSession(): MainUser | null {
    return getMainSession();
  },

  linkOrgToUser(mainUserId: string, orgId: string) {
    const users = loadMainUsers();
    const user = users.find(u => u.id === mainUserId);
    if (user && !user.linked_org_ids.includes(orgId)) {
      user.linked_org_ids.push(orgId);
      saveMainUsers(users);
      // Update session too
      const session = getMainSession();
      if (session?.id === mainUserId) {
        session.linked_org_ids = user.linked_org_ids;
        setMainSession(session);
      }
    }
  },

  getLinkedOrgIds(): string[] {
    const session = getMainSession();
    return session?.linked_org_ids || [];
  },
};
