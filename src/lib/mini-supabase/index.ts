import { loadDB, saveDB } from './mini-db';

export { miniDB } from './mini-query';
export { miniAuth } from './mini-auth';
export { loadDB, saveDB } from './mini-db';
export type { UserRole, MiniUser } from './mini-db';
export { isAdminEmail } from './mini-db';

export async function resetDB() {

  const db = await loadDB();

  const adminUsers = (db.users || []).filter((u:any) => u.role === "admin");

  const newDB = {
    users: adminUsers,
    handlers: [],
    clients: [],
    payments: [],
    invoices: [],
    pending_checklist: [],
    audit_logs: [],
    approvals: [],
    collections: [],
    risk_detection: [],
    ai_planner: [],
    excel_sync: []
  };

  await saveDB(newDB);

}

export { processUploadBatch, verifyPayloadHash } from '../upload-engine';