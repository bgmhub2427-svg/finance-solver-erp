import {
  loadGlobalData, saveGlobalData, loadFYData, saveFYData,
  loadLegacyDatabase, getActiveFY, setActiveFY as setActiveFYStorage,
  getAvailableFYs, setAvailableFYs,
  type GlobalData, type FYData,
} from './mini-indexeddb';

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

// ── In-memory caches ────────────────────────────────────────────────
let memGlobal: GlobalData | null = null;
let memFY: { fy: string; data: FYData } | null = null;

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

const GLOBAL_FIELDS: (keyof ERPDatabase)[] = ['users', 'handlers', 'audit_logs'];
const FY_FIELDS: (keyof ERPDatabase)[] = [
  'clients', 'payments', 'invoices', 'invoice_items',
  'income', 'expenses', 'fee_types', 'client_fees',
  'upload_batches', 'raw_json_logs', 'client_lifecycle',
  'month_locks', 'fraud_alerts',
];

function defaultGlobal(): GlobalData {
  return {
    users: [
      { id: uid(), email: 'admin@ka.com', password: 'Ka@2026', role: 'admin', handler_id: null },
      { id: uid(), email: 'suneelkumarkota@admin.com', password: 'KA@SKK@fee.123', role: 'admin', handler_id: null },
      { id: uid(), email: 'saikarthikkota@admin.com', password: 'KA@SKBSK@fee.123', role: 'admin', handler_id: null },
      { id: uid(), email: 'jana@admin.com', password: 'KA@JA@fee.123', role: 'admin', handler_id: null },
      { id: uid(), email: 'manohar@admin.com', password: 'KA@M@fee.123', role: 'admin', handler_id: null },
    ],
    handlers: [],
    audit_logs: [],
  };
}

function defaultFYData(): FYData {
  return {
    clients: [],
    payments: [],
    invoices: [],
    invoice_items: [],
    income: [],
    expenses: [],
    fee_types: [],
    client_fees: [],
    upload_batches: [],
    raw_json_logs: [],
    client_lifecycle: [],
    month_locks: [],
    fraud_alerts: [],
  };
}

export function defaultDB(): ERPDatabase {
  return { ...defaultGlobal(), ...defaultFYData() };
}

function ensureGlobalFields(g: any): GlobalData {
  const defaults = defaultGlobal();
  const merged: any = { ...g };
  for (const key of GLOBAL_FIELDS) {
    if (!Array.isArray(merged[key])) merged[key] = (defaults as any)[key];
  }
  // Ensure all admin accounts exist
  const existingEmails = new Set((merged.users as MiniUser[]).map(u => u.email.toLowerCase()));
  for (const du of defaults.users) {
    if (!existingEmails.has(du.email.toLowerCase())) merged.users.push(du);
  }
  // Ensure admin emails have admin role
  for (const user of merged.users as MiniUser[]) {
    if (isAdminEmail(user.email) && user.role !== 'admin') user.role = 'admin';
  }
  return merged as GlobalData;
}

function ensureFYFields(f: any): FYData {
  const defaults = defaultFYData();
  const merged: any = { ...f };
  for (const key of FY_FIELDS) {
    if (!Array.isArray(merged[key])) merged[key] = (defaults as any)[key];
  }
  return merged as FYData;
}

function splitDB(db: ERPDatabase): { global: GlobalData; fyData: FYData } {
  const global: any = {};
  for (const key of GLOBAL_FIELDS) global[key] = (db as any)[key];
  const fyData: any = {};
  for (const key of FY_FIELDS) fyData[key] = (db as any)[key];
  return { global: global as GlobalData, fyData: fyData as FYData };
}

// ── Load / Save ─────────────────────────────────────────────────────

export async function loadDB(): Promise<ERPDatabase> {
  const fy = getActiveFY();

  // Return cached if available and same FY
  if (memGlobal && memFY && memFY.fy === fy) {
    return clone({ ...memGlobal, ...memFY.data } as ERPDatabase);
  }

  // Load global
  let global = await loadGlobalData();
  if (!global) {
    // Try legacy migration
    const legacy = await loadLegacyDatabase();
    if (legacy) {
      const split = splitDB(legacy as ERPDatabase);
      global = ensureGlobalFields(split.global);
      const fyData = ensureFYFields(split.fyData);
      await Promise.all([saveGlobalData(global), saveFYData(fy, fyData)]);
      memGlobal = global;
      memFY = { fy, data: fyData };
      return clone({ ...global, ...fyData } as ERPDatabase);
    }
    global = defaultGlobal();
    await saveGlobalData(global);
  }
  global = ensureGlobalFields(global);

  // Load FY data
  let fyData = await loadFYData(fy);
  if (!fyData) {
    fyData = defaultFYData();
    await saveFYData(fy, fyData);
  }
  fyData = ensureFYFields(fyData);

  memGlobal = global;
  memFY = { fy, data: fyData };

  // Ensure FY is in list
  const fys = getAvailableFYs();
  if (!fys.includes(fy)) {
    fys.push(fy);
    fys.sort();
    setAvailableFYs(fys);
  }

  return clone({ ...global, ...fyData } as ERPDatabase);
}

export async function saveDB(db: ERPDatabase) {
  const fy = getActiveFY();
  const { global, fyData } = splitDB(db);
  const snapshot = clone(db);
  memGlobal = clone(global);
  memFY = { fy, data: clone(fyData) };
  await Promise.all([saveGlobalData(global), saveFYData(fy, fyData)]);
}

export async function resetDB() {
  const fy = getActiveFY();
  const global = defaultGlobal();
  const fyData = defaultFYData();
  memGlobal = global;
  memFY = { fy, data: fyData };
  await Promise.all([saveGlobalData(global), saveFYData(fy, fyData)]);
  return clone({ ...global, ...fyData } as ERPDatabase);
}

export function genId() {
  return uid();
}

// ── FY Management ───────────────────────────────────────────────────

export { getActiveFY, getAvailableFYs, setAvailableFYs };

export function switchFY(fy: string) {
  setActiveFYStorage(fy);
  // Invalidate FY cache so next loadDB fetches correct data
  memFY = null;
}

export async function createFinancialYear(newFY: string, carryForward: boolean = true): Promise<void> {
  // Check if FY already exists
  const existing = await loadFYData(newFY);
  if (existing && existing.clients && existing.clients.length > 0) {
    throw new Error(`Financial Year ${newFY} already has data`);
  }

  const currentFY = getActiveFY();
  let newFYData = defaultFYData();

  if (carryForward) {
    // Load current FY data to carry forward clients
    const currentData = await loadFYData(currentFY);
    if (currentData && currentData.clients) {
      newFYData.clients = currentData.clients
        .filter((c: any) => !c.deleted && c.status !== 'inactive')
        .map((c: any) => ({
          ...c,
          id: uid(),
          financial_year: newFY,
          // Carry forward pending as previous year pending
          previous_year_pending: Number(c.total_pending || 0),
          // Old fee becomes the new fee from previous year
          old_fee: Number(c.new_fee || c.old_fee || 0),
          old_fee_end_month: 'March',
          old_fee_due: 0,
          new_fee: Number(c.new_fee || 0),
          new_fee_start_month: 'April',
          new_fee_due: 0,
          total_paid_fy: 0,
          total_pending: Number(c.total_pending || 0), // Carry forward pending
          paid_term: '',
          created_at: new Date().toISOString(),
        }));
    }
  }

  await saveFYData(newFY, newFYData);

  // Add to FY list
  const fys = getAvailableFYs();
  if (!fys.includes(newFY)) {
    fys.push(newFY);
    fys.sort();
    setAvailableFYs(fys);
  }
}

export async function deleteFinancialYear(fy: string): Promise<void> {
  const fys = getAvailableFYs();
  if (fys.length <= 1) throw new Error('Cannot delete the only financial year');
  
  // Save empty data (effectively deleting)
  await saveFYData(fy, defaultFYData());
  
  const newFYs = fys.filter(f => f !== fy);
  setAvailableFYs(newFYs);
  
  // If active FY was deleted, switch to the latest
  if (getActiveFY() === fy) {
    const latest = newFYs[newFYs.length - 1];
    switchFY(latest);
  }
}
