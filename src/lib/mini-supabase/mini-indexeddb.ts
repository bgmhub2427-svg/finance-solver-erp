import { DB_KEY, readJSON, removeKey, writeJSON } from './mini-storage';
import type { ERPDatabase } from './mini-db';

const DB_NAME = 'erp_mini_supabase';
const STORE_NAME = 'state';
const STATE_KEY = 'database';
const SYNC_KEY = 'erp_sync_event';

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
    const req = idb.open(DB_NAME, 1);

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

async function readState(): Promise<ERPDatabase | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(STATE_KEY);

    req.onsuccess = () => resolve((req.result as ERPDatabase | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function writeState(state: ERPDatabase): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    writeJSON(DB_KEY, state);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(state, STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  if (typeof window !== 'undefined') {
    localStorage.setItem(SYNC_KEY, String(Date.now()));
  }
}

export async function loadDatabaseState(): Promise<ERPDatabase | null> {
  const indexed = await readState();
  if (indexed) return indexed;

  // One-time migration from legacy localStorage DB.
  const legacy = readJSON<ERPDatabase | null>(DB_KEY, null);
  if (legacy) {
    await writeState(legacy);
    removeKey(DB_KEY);
    return legacy;
  }

  return null;
}

export async function saveDatabaseState(state: ERPDatabase): Promise<void> {
  writeQueue = writeQueue.then(() => writeState(state)).catch(() => writeState(state));
  await writeQueue;
}

export async function clearDatabaseState(): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    removeKey(DB_KEY);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
