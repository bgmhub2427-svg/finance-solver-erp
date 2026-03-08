import { DB_KEY, readJSON, removeKey, writeJSON } from './mini-storage';
import type { ERPDatabase } from './mini-db';

const DB_NAME = 'erp_mini_supabase';
const STORE_NAME = 'state';
const GLOBAL_KEY = 'global';
const SYNC_KEY = 'erp_sync_event';
const ACTIVE_FY_KEY = 'erp_active_fy';
const FY_LIST_KEY = 'erp_fy_list';

// ── Active FY tracking ──────────────────────────────────────────────
let _activeFY: string = '2025-2026';

export function getActiveFY(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(ACTIVE_FY_KEY);
    if (stored) _activeFY = stored;
  }
  return _activeFY;
}

export function setActiveFY(fy: string) {
  _activeFY = fy;
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACTIVE_FY_KEY, fy);
  }
}

// ── FY list management ──────────────────────────────────────────────
export function getAvailableFYs(): string[] {
  if (typeof window === 'undefined') return ['2025-2026'];
  const raw = localStorage.getItem(FY_LIST_KEY);
  if (!raw) return ['2024-2025', '2025-2026', '2026-2027'];
  try { return JSON.parse(raw); } catch { return ['2025-2026']; }
}

export function setAvailableFYs(fys: string[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(FY_LIST_KEY, JSON.stringify(fys));
  }
}

// ── Global fields (shared across FYs) ───────────────────────────────
const GLOBAL_FIELDS: (keyof ERPDatabase)[] = ['users', 'handlers', 'audit_logs'];
const FY_FIELDS: (keyof ERPDatabase)[] = [
  'clients', 'payments', 'invoices', 'invoice_items',
  'income', 'expenses', 'fee_types', 'client_fees',
  'upload_batches', 'raw_json_logs', 'client_lifecycle',
  'month_locks', 'fraud_alerts',
];

export type GlobalData = Pick<ERPDatabase, 'users' | 'handlers' | 'audit_logs'>;
export type FYData = Omit<ERPDatabase, 'users' | 'handlers' | 'audit_logs'>;

function fyKey(fy: string) { return `fy_${fy}`; }

// ── IndexedDB helpers ───────────────────────────────────────────────
let databasePromise: Promise<IDBDatabase | null> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function getIndexedDB(): IDBFactory | null {
  if (typeof window === 'undefined') return null;
  return window.indexedDB ?? null;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise;

  const idb = getIndexedDB();
  if (!idb) {
    databasePromise = Promise.resolve(null);
    return databasePromise;
  }

  databasePromise = new Promise((resolve) => {
    const req = idb.open(DB_NAME, 2);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });

  return databasePromise;
}

async function readState<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function writeState<T>(key: string, state: T): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    writeJSON(key, state);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(state, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  if (typeof window !== 'undefined') {
    localStorage.setItem(SYNC_KEY, String(Date.now()));
  }
}

// ── Public API ──────────────────────────────────────────────────────

export async function loadGlobalData(): Promise<GlobalData | null> {
  return readState<GlobalData>(GLOBAL_KEY);
}

export async function saveGlobalData(data: GlobalData): Promise<void> {
  writeQueue = writeQueue.then(() => writeState(GLOBAL_KEY, data)).catch(() => writeState(GLOBAL_KEY, data));
  await writeQueue;
}

export async function loadFYData(fy: string): Promise<FYData | null> {
  return readState<FYData>(fyKey(fy));
}

export async function saveFYData(fy: string, data: FYData): Promise<void> {
  writeQueue = writeQueue.then(() => writeState(fyKey(fy), data)).catch(() => writeState(fyKey(fy), data));
  await writeQueue;
}

// ── Legacy migration: load old single-blob DB ───────────────────────
export async function loadLegacyDatabase(): Promise<ERPDatabase | null> {
  // Try IndexedDB legacy key
  const legacy = await readState<ERPDatabase>('database');
  if (legacy) return legacy;

  // Try localStorage legacy key
  const lsLegacy = readJSON<ERPDatabase | null>(DB_KEY, null);
  if (lsLegacy) {
    removeKey(DB_KEY);
    return lsLegacy;
  }

  return null;
}

// Kept for backward compat – wraps the new split approach
export async function loadDatabaseState(): Promise<ERPDatabase | null> {
  const fy = getActiveFY();
  const [global, fyData] = await Promise.all([loadGlobalData(), loadFYData(fy)]);

  if (!global && !fyData) {
    // Try legacy migration
    const legacy = await loadLegacyDatabase();
    return legacy;
  }

  if (!global || !fyData) return null;

  return { ...global, ...fyData } as ERPDatabase;
}

export async function saveDatabaseState(state: ERPDatabase): Promise<void> {
  const fy = getActiveFY();

  const global: any = {};
  for (const key of GLOBAL_FIELDS) {
    global[key] = (state as any)[key];
  }

  const fyData: any = {};
  for (const key of FY_FIELDS) {
    fyData[key] = (state as any)[key];
  }

  await Promise.all([
    saveGlobalData(global as GlobalData),
    saveFYData(fy, fyData as FYData),
  ]);

  // Ensure FY is in the list
  const fys = getAvailableFYs();
  if (!fys.includes(fy)) {
    fys.push(fy);
    fys.sort();
    setAvailableFYs(fys);
  }
}

export async function clearDatabaseState(): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    removeKey(DB_KEY);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
