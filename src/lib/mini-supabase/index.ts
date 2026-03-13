import { loadDB, saveDB } from './mini-db';

export { miniDB } from './mini-query';
export { miniAuth } from './mini-auth';
export { loadDB, saveDB } from './mini-db';
export type { UserRole, MiniUser } from './mini-db';
export { isAdminEmail, switchFY, createFinancialYear, deleteFinancialYear, getActiveFY, getAvailableFYs, setAvailableFYs, genId } from './mini-db';

export async function resetDB() {
  const db = await loadDB();
  const adminUsers = (db.users || []).filter((u:any) => u.role === "admin");

  const newDB = {
    users: adminUsers,
    handlers: [],
    clients: [],
    payments: [],
    invoices: [],
    invoice_items: [],
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
    salaries: [],
  };

  await saveDB(newDB as any);
}

export { processUploadBatch, verifyPayloadHash } from '../upload-engine';
