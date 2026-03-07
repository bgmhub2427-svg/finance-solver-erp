import { genId, loadDB, MiniUser, saveDB, isAdminEmail } from './mini-db';
import { removeKey, readJSON, SESSION_KEY, writeJSON } from './mini-storage';

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

    // Ensure admin emails always have admin role
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

  async signUp(email: string, password: string) {
    const db = await loadDB();
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { error: new Error('User already exists') };
    }

    const role = isAdminEmail(email) ? 'admin' : 'viewer';

    const user: MiniUser = {
      id: genId(),
      email,
      password,
      role,
      handler_id: null,
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

    writeJSON(SESSION_KEY, { user: { ...user } });
    emit('SIGNED_IN');
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

  async createHandlerUser(params: { email: string; password: string; handler_code: string; handler_name: string }) {
    const current = this.getCurrentUser();
    if (!current || current.role !== 'admin') return { error: new Error('Only admin can create handlers') };

    const db = await loadDB();
    if (db.users.some((u) => u.email.toLowerCase() === params.email.toLowerCase())) {
      return { error: new Error('Email already exists') };
    }

    const user: MiniUser = { id: genId(), email: params.email, password: params.password, role: 'handler', handler_id: null };
    const existingHandler = db.handlers.find((h) => h.code === params.handler_code);

    if (existingHandler) {
      existingHandler.name = params.handler_name;
      existingHandler.user_id = user.id;
      existingHandler.active = true;
    } else {
      db.handlers.push({
        id: genId(),
        code: params.handler_code,
        name: params.handler_name,
        active: true,
        user_id: user.id,
        created_at: new Date().toISOString(),
      });
    }

    user.handler_id = user.id;
    db.users.push(user);
    db.audit_logs.push({
      id: genId(),
      user_id: current.id,
      user_email: current.email,
      role: current.role,
      action: 'create_handler',
      module: 'handlers',
      record_id: user.id,
      ip_address: 'local',
      timestamp: new Date().toISOString(),
    });
    await saveDB(db);

    return { data: { user }, error: null };
  },
};
