import { loadDatabaseState, saveDatabaseState } from './mini-indexeddb';

export type UserRole = 'admin' | 'manager' | 'handler' | 'viewer';

export interface MiniUser {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  handler_id: string | null;
}

export interface ERPDatabase {
  users: MiniUser[];
  clients: Record<string, any>[];
  payments: Record<string, any>[];
  invoices: Record<string, any>[];
  invoice_items: Record<string, any>[];
  handlers: Record<string, any>[];
  income: Record<string, any>[];
  expenses: Record<string, any>[];
  audit_logs: Record<string, any>[];
  fee_types: Record<string, any>[];
  client_fees: Record<string, any>[];
  upload_batches: Record<string, any>[];
  raw_json_logs: Record<string, any>[];
  client_lifecycle: Record<string, any>[];
  month_locks: Record<string, any>[];
  fraud_alerts: Record<string, any>[];
}

const DEFAULT_HANDLERS = [

];

// Admin email list — any email here gets admin role on signup
const ADMIN_EMAILS = [
  'admin@ka.com',
  'suneelkumarkota@admin.com',
  'saikarthikkota@admin.com',
  'jana@admin.com',
  'manohar@admin.com',
];

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

const uid = () => (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

let memDB: ERPDatabase | null = null;

function cloneDB(db: ERPDatabase): ERPDatabase {
  return JSON.parse(JSON.stringify(db)) as ERPDatabase;
}

export function defaultDB(): ERPDatabase {
  return {
    users: [
      { id: uid(), email: 'admin@ka.com', password: 'Ka@2026', role: 'admin', handler_id: null },
      { id: uid(), email: 'suneelkumarkota@admin.com', password: 'KA@SKK@fee.123', role: 'admin', handler_id: null },
      { id: uid(), email: 'saikarthikkota@admin.com', password: 'KA@SKBSK@fee.123', role: 'admin', handler_id: null },
      { id: uid(), email: 'jana@admin.com', password: 'KA@JA@fee.123', role: 'admin', handler_id: null },
      { id: uid(), email: 'manohar@admin.com', password: 'KA@M@fee.123', role: 'admin', handler_id: null },
    ],
    clients: [],
    payments: [],
    invoices: [],
    invoice_items: [],
    handlers: DEFAULT_HANDLERS.map(([code, name]) => ({ id: uid(), code, name, active: true, user_id: null, created_at: new Date().toISOString() })),
    income: [],
    expenses: [],
    audit_logs: [],
    fee_types: [],
    client_fees: [],
    upload_batches: [],
    raw_json_logs: [],
    client_lifecycle: [],
    month_locks: [],
    fraud_alerts: [],
  };
}

function ensureAllFields(db: any): ERPDatabase {
  const defaults = defaultDB();
  const merged: any = { ...db };
  for (const key of Object.keys(defaults) as (keyof ERPDatabase)[]) {
    if (!Array.isArray(merged[key])) {
      merged[key] = defaults[key];
    }
  }
  // Ensure all admin accounts exist
  const existingEmails = new Set((merged.users as MiniUser[]).map(u => u.email.toLowerCase()));
  const defaultUsers = defaults.users;
  for (const du of defaultUsers) {
    if (!existingEmails.has(du.email.toLowerCase())) {
      merged.users.push(du);
    }
  }
  // Ensure existing admin emails have admin role
  for (const user of merged.users as MiniUser[]) {
    if (isAdminEmail(user.email) && user.role !== 'admin') {
      user.role = 'admin';
    }
  }
  return merged as ERPDatabase;
}

export async function loadDB(): Promise<ERPDatabase> {
  if (memDB) return cloneDB(memDB);

  const persisted = await loadDatabaseState();
  if (persisted) {
    memDB = ensureAllFields(persisted);
    await saveDatabaseState(memDB);
    return cloneDB(memDB);
  }

  memDB = defaultDB();
  await saveDatabaseState(memDB);
  return cloneDB(memDB);
}

export async function saveDB(db: ERPDatabase) {
  const snapshot = cloneDB(db);
  memDB = snapshot;
  await saveDatabaseState(snapshot);
}

export async function resetDB() {
  const seed = defaultDB();
  memDB = seed;
  await saveDatabaseState(seed);
  return cloneDB(seed);
}

export function genId() {
  return uid();
}
