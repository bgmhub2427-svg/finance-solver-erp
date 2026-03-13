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
  org_id?: string | null;
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
  salaries: Record<string, any>[];
}

// Admin emails are now dynamic per-organization — no hardcoded list
const ADMIN_EMAILS: string[] = [];

export function isAdminEmail(_email: string): boolean {
  return false; // No hardcoded admins — roles are assigned during org setup
}

const uid = () => (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

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
    users: [],
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

export async function loadDB(): Promise<ERPDatabase> {
  const fy = getActiveFY();

  if (memGlobal && memFY && memFY.fy === fy) {
    return clone({ ...memGlobal, ...memFY.data } as ERPDatabase);
  }

  let global = await loadGlobalData();
  if (!global) {
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

  let fyData = await loadFYData(fy);
  if (!fyData) {
    fyData = defaultFYData();
    await saveFYData(fy, fyData);
  }
  fyData = ensureFYFields(fyData);

  memGlobal = global;
  memFY = { fy, data: fyData };

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

export { getActiveFY, getAvailableFYs, setAvailableFYs };

export function switchFY(fy: string) {
  setActiveFYStorage(fy);
  memFY = null;
}

export async function createFinancialYear(newFY: string, carryForward: boolean = true): Promise<void> {
  const existing = await loadFYData(newFY);
  if (existing && existing.clients && existing.clients.length > 0) {
    throw new Error(`Financial Year ${newFY} already has data`);
  }

  const currentFY = getActiveFY();
  let newFYData = defaultFYData();

  if (carryForward) {
    const currentData = await loadFYData(currentFY);
    if (currentData && currentData.clients) {
      newFYData.clients = currentData.clients
        .filter((c: any) => !c.deleted && c.status !== 'inactive')
        .map((c: any) => ({
          ...c,
          id: uid(),
          financial_year: newFY,
          previous_year_pending: Number(c.total_pending || 0),
          old_fee: Number(c.new_fee || c.old_fee || 0),
          old_fee_end_month: 'March',
          old_fee_due: 0,
          new_fee: Number(c.new_fee || 0),
          new_fee_start_month: 'April',
          new_fee_due: 0,
          total_paid_fy: 0,
          total_pending: Number(c.total_pending || 0),
          paid_term: '',
          created_at: new Date().toISOString(),
        }));
    }
  }

  await saveFYData(newFY, newFYData);

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
  
  await saveFYData(fy, defaultFYData());
  
  const newFYs = fys.filter(f => f !== fy);
  setAvailableFYs(newFYs);
  
  if (getActiveFY() === fy) {
    const latest = newFYs[newFYs.length - 1];
    switchFY(latest);
  }
}
