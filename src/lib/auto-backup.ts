import { loadDB } from '@/lib/mini-supabase';

const BACKUP_INTERVAL_KEY = 'erp_backup_interval';
const LAST_BACKUP_KEY = 'erp_last_backup';

export type BackupInterval = 'off' | 'daily' | 'weekly';

export function getBackupInterval(): BackupInterval {
  return (localStorage.getItem(BACKUP_INTERVAL_KEY) as BackupInterval) || 'off';
}

export function setBackupInterval(interval: BackupInterval) {
  localStorage.setItem(BACKUP_INTERVAL_KEY, interval);
}

export function getLastBackupTime(): number {
  return Number(localStorage.getItem(LAST_BACKUP_KEY) || '0');
}

function setLastBackupTime() {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
}

async function performBackup() {
  const db = await loadDB();
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `erp-auto-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setLastBackupTime();
}

function shouldBackup(): boolean {
  const interval = getBackupInterval();
  if (interval === 'off') return false;

  const last = getLastBackupTime();
  const now = Date.now();
  const elapsed = now - last;

  if (interval === 'daily') return elapsed > 24 * 60 * 60 * 1000;
  if (interval === 'weekly') return elapsed > 7 * 24 * 60 * 60 * 1000;
  return false;
}

let timerStarted = false;

export function startAutoBackup() {
  if (timerStarted) return;
  timerStarted = true;

  // Check on startup (slight delay to not block UI)
  setTimeout(() => {
    if (shouldBackup()) performBackup();
  }, 5000);

  // Check every hour
  setInterval(() => {
    if (shouldBackup()) performBackup();
  }, 60 * 60 * 1000);
}
