export const DB_KEY = 'erp_database';
export const SESSION_KEY = 'erp_session';

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string) {
  localStorage.removeItem(key);
}
