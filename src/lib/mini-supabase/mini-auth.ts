import { genId, loadDB, MiniUser, UserRole, saveDB, isAdminEmail } from './mini-db';
import { removeKey, readJSON, SESSION_KEY, writeJSON } from './mini-storage';
import { validatePassword } from '@/lib/org-types';

type Session = { user: MiniUser };
type Listener = (event: 'SIGNED_IN' | 'SIGNED_OUT', session: Session | null) => void;
const listeners = new Set<Listener>();

function getSessionSync(): Session | null {
  return readJSON<Session | null>(SESSION_KEY, null);
}

function emit(event: 'SIGNED_IN' | 'SIGNED_OUT') {
  const session = getSessionSync();
  listeners.forEach((cb) => cb(event, session));
}

export const miniAuth = {
  async signIn(email: string, password: string) {
    const db = await loadDB();
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) return { error: new Error('Invalid credentials') };

    if (isAdminEmail(user.email) && user.role !== 'admin') {
      user.role = 'admin';
      await saveDB(db);
    }

    db.audit_logs.push({
      id: genId(),
      user_id: user.id,
      user_email: user.email,
      role: user.role,
      action: 'login',
      module: 'auth',
      record_id: user.id,
      ip_address: 'local',
      timestamp: new Date().toISOString(),
    });
    await saveDB(db);

    const session: Session = { user: { ...user } };
    writeJSON(SESSION_KEY, session);
    emit('SIGNED_IN');
    return { data: { user: session.user }, error: null };
  },

  async signUp(email: string, password: string, opts?: { skipSession?: boolean; role?: UserRole }) {
    // Strong password validation
    const { valid, errors } = validatePassword(password);
    if (!valid) {
      return { error: new Error(`Weak password: ${errors.join(', ')}`) };
    }

    const db = await loadDB();
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { error: new Error('User already exists') };
    }

    const role: UserRole = opts?.role || 'admin'; // Default to admin for new signups

    const user: MiniUser = {
      id: genId(),
      email,
      password,
      role,
      handler_id: null,
      org_id: null,
    };

    db.users.push(user);
    db.audit_logs.push({
      id: genId(),
      user_id: user.id,
      user_email: user.email,
      role: user.role,
      action: 'signup',
      module: 'auth',
      record_id: user.id,
      ip_address: 'local',
      timestamp: new Date().toISOString(),
    });
    await saveDB(db);

    if (!opts?.skipSession) {
      writeJSON(SESSION_KEY, { user: { ...user } });
      emit('SIGNED_IN');
    }
    return { data: { user }, error: null };
  },

  async signOut() {
    const user = this.getCurrentUser();
    if (user) {
      const db = await loadDB();
      db.audit_logs.push({
        id: genId(),
        user_id: user.id,
        user_email: user.email,
        role: user.role,
        action: 'logout',
        module: 'auth',
        record_id: user.id,
        ip_address: 'local',
        timestamp: new Date().toISOString(),
      });
      await saveDB(db);
    }
    removeKey(SESSION_KEY);
    emit('SIGNED_OUT');
    return { error: null };
  },

  async getUser() {
    const session = getSessionSync();
    return { data: { user: session?.user ?? null }, error: null };
  },

  async getSession() {
    return { data: { session: getSessionSync() }, error: null };
  },

  onAuthStateChange(callback: Listener) {
    listeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(callback),
        },
      },
    };
  },

  getCurrentUser() {
    return getSessionSync()?.user ?? null;
  },

  async updateUserOrgId(userId: string, orgId: string) {
    const db = await loadDB();
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.org_id = orgId;
      await saveDB(db);
      // Update session
      const session = getSessionSync();
      if (session?.user?.id === userId) {
        session.user.org_id = orgId;
        writeJSON(SESSION_KEY, session);
      }
    }
  },

  async updateUserRole(userId: string, newRole: UserRole) {
    const current = this.getCurrentUser();
    if (!current || (current.role !== 'admin' && current.role !== 'manager')) {
      return { error: new Error('Only admin/manager can change roles') };
    }
    const db = await loadDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return { error: new Error('User not found') };
    user.role = newRole;
    db.audit_logs.push({
      id: genId(),
      user_id: current.id,
      user_email: current.email,
      role: current.role,
      action: 'update_role',
      module: 'users',
      record_id: userId,
      details: `Changed role to ${newRole}`,
      ip_address: 'local',
      timestamp: new Date().toISOString(),
    });
    await saveDB(db);
    return { data: { user }, error: null };
  },

  /**
   * Create a user with any role (admin-only operation).
   * For handlers, also creates the handler record.
   */
  async createOrgUser(params: {
    email: string;
    password: string;
    role: UserRole;
    org_id?: string;
    handler_code?: string;
    handler_name?: string;
  }) {
    const current = this.getCurrentUser();
    if (!current || (current.role !== 'admin' && current.role !== 'manager')) {
      return { error: new Error('Only admin/manager can create users') };
    }

    const { valid, errors } = validatePassword(params.password);
    if (!valid) {
      return { error: new Error(`Weak password: ${errors.join(', ')}`) };
    }

    const db = await loadDB();
    if (db.users.some((u) => u.email.toLowerCase() === params.email.toLowerCase())) {
      return { error: new Error('Email already exists') };
    }

    const user: MiniUser = {
      id: genId(),
      email: params.email,
      password: params.password,
      role: params.role,
      handler_id: null,
      org_id: params.org_id || current.org_id || null,
    };

    // If creating a handler, also create handler record
    if (params.role === 'handler' && params.handler_code) {
      const existingHandler = db.handlers.find((h) => h.code === params.handler_code);
      if (existingHandler) {
        existingHandler.name = params.handler_name || params.email;
        existingHandler.user_id = user.id;
        existingHandler.active = true;
      } else {
        db.handlers.push({
          id: genId(),
          code: params.handler_code,
          name: params.handler_name || params.email,
          active: true,
          user_id: user.id,
          org_id: params.org_id || current.org_id || null,
          created_at: new Date().toISOString(),
        });
      }
      user.handler_id = user.id;
    }

    db.users.push(user);
    db.audit_logs.push({
      id: genId(),
      user_id: current.id,
      user_email: current.email,
      role: current.role,
      action: `create_${params.role}`,
      module: 'users',
      record_id: user.id,
      ip_address: 'local',
      timestamp: new Date().toISOString(),
    });
    await saveDB(db);

    return { data: { user }, error: null };
  },

  // Backward compat wrapper
  async createHandlerUser(params: { email: string; password: string; handler_code: string; handler_name: string; org_id?: string }) {
    return this.createOrgUser({
      ...params,
      role: 'handler',
    });
  },
};
