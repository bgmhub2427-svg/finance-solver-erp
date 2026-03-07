import { genId, loadDB, saveDB } from '@/lib/mini-supabase/mini-db';

export interface UploadMetadata {
  timestamp: string;
  version: string;
  file_hash: string;
  source?: string;
}

export interface UploadFeeItem {
  type: string;
  total: number;
  received: number;
}

export interface UploadPayment {
  date: string;
  amount: number;
  mode: string;
  reference?: string;
}

export interface UploadClientRecord {
  client_id: string;
  name: string;
  phone?: string;
  gst_number?: string;
  pan?: string;
  status?: 'active' | 'inactive';
  handler_code: string;
  fees: UploadFeeItem[];
  payments?: UploadPayment[];
}

export interface UploadPayload {
  metadata: UploadMetadata;
  handler: {
    code: string;
    name: string;
    email: string;
  };
  clients: UploadClientRecord[];
}

export interface UploadAuth {
  employeeEmail: string;
  employeePassword: string;
  adminEmail: string;
  adminPassword: string;
}

function normalizeFeeType(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, '_');
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPayloadHash(payload: UploadPayload) {
  const raw = JSON.stringify(payload.clients);
  const hash = await sha256(raw);
  return hash === payload.metadata.file_hash;
}

export async function processUploadBatch(payload: UploadPayload, auth: UploadAuth) {
  const now = new Date().toISOString();
  const db = await loadDB();

  const employee = db.users.find((u) => u.email.toLowerCase() === auth.employeeEmail.toLowerCase() && u.password === auth.employeePassword);
  if (!employee || !['handler', 'manager', 'admin'].includes(employee.role)) {
    throw new Error('Employee authentication failed.');
  }

  const admin = db.users.find((u) => u.email.toLowerCase() === auth.adminEmail.toLowerCase() && u.password === auth.adminPassword && u.role === 'admin');
  if (!admin) {
    throw new Error('Admin authentication failed.');
  }

  const hashOk = await verifyPayloadHash(payload);
  if (!hashOk) {
    throw new Error('File hash verification failed.');
  }

  if (!db.upload_batches) db.upload_batches = [];
  if (!db.raw_json_logs) db.raw_json_logs = [];
  if (!db.client_fees) db.client_fees = [];
  if (!db.fee_types) db.fee_types = [];
  if (!db.client_lifecycle) db.client_lifecycle = [];
  if (!db.fraud_alerts) db.fraud_alerts = [];

  if (db.upload_batches.some((b: any) => b.file_hash === payload.metadata.file_hash)) {
    throw new Error('Duplicate upload detected by file hash.');
  }

  const lockMonth = payload.metadata.timestamp.slice(0, 7);
  const isMonthLocked = (db.month_locks || []).some((m: any) => m.month === lockMonth && m.locked);
  if (isMonthLocked) {
    throw new Error(`Month ${lockMonth} is locked. Upload blocked.`);
  }

  const working = JSON.parse(JSON.stringify(db));

  const batchId = genId();
  working.upload_batches.push({
    id: batchId,
    file_hash: payload.metadata.file_hash,
    uploaded_by: employee.id,
    approved_by: admin.id,
    uploaded_at: now,
    status: 'processed',
    version: payload.metadata.version,
  });

  working.raw_json_logs.push({
    id: genId(),
    batch_id: batchId,
    payload,
    logged_at: now,
  });

  const ensureFeeType = (label: string) => {
    const key = normalizeFeeType(label);
    let row = working.fee_types.find((f: any) => f.key === key);
    if (!row) {
      row = { id: genId(), key, label, active: true, created_at: now };
      working.fee_types.push(row);
    }
    return row;
  };

  let handler = working.handlers.find((h: any) => h.code === payload.handler.code);
  if (!handler) {
    handler = {
      id: genId(),
      code: payload.handler.code,
      name: payload.handler.name,
      active: false,
      approval_status: 'pending',
      user_id: employee.id,
      created_at: now,
    };
    working.handlers.push(handler);
  }

  for (const clientData of payload.clients) {
    let client = working.clients.find((c: any) => c.client_id === clientData.client_id);

    if (!client) {
      client = {
        id: genId(),
        client_id: clientData.client_id,
        name: clientData.name,
        phone: clientData.phone || '',
        gst_number: clientData.gst_number || '',
        pan: clientData.pan || '',
        status: clientData.status || 'active',
        handler_code: clientData.handler_code,
        handler_id: handler.user_id || null,
        financial_year: '2025-2026',
        old_fee: 0,
        new_fee: 0,
        old_fee_due: 0,
        new_fee_due: 0,
        total_paid_fy: 0,
        total_pending: 0,
        paid_term: '',
        created_at: now,
      };
      working.clients.push(client);
    } else {
      client.name = clientData.name;
      client.phone = clientData.phone || client.phone;
      client.gst_number = clientData.gst_number || client.gst_number;
      client.pan = clientData.pan || client.pan;
      client.status = clientData.status || client.status;
      client.handler_code = clientData.handler_code;
      client.handler_id = handler.user_id || client.handler_id;
    }

    let totalAmount = 0;
    let totalReceived = 0;

    for (const fee of clientData.fees) {
      const feeType = ensureFeeType(fee.type);
      totalAmount += Number(fee.total || 0);
      totalReceived += Number(fee.received || 0);

      const pending = Number(fee.total || 0) - Number(fee.received || 0);
      if (pending < 0) {
        working.fraud_alerts.push({
          id: genId(),
          batch_id: batchId,
          type: 'negative_pending',
          client_id: client.id,
          message: `Negative pending for ${client.client_id}/${fee.type}`,
          created_at: now,
        });
      }

      const existingClientFee = working.client_fees.find((f: any) => f.client_id === client.id && f.fee_type_id === feeType.id);
      if (existingClientFee) {
        existingClientFee.total_amount = Number(fee.total || 0);
        existingClientFee.received_amount = Number(fee.received || 0);
        existingClientFee.pending_amount = pending;
        existingClientFee.status = pending <= 0 ? 'completed' : 'pending';
        existingClientFee.updated_at = now;
      } else {
        working.client_fees.push({
          id: genId(),
          client_id: client.id,
          fee_type_id: feeType.id,
          total_amount: Number(fee.total || 0),
          received_amount: Number(fee.received || 0),
          pending_amount: pending,
          status: pending <= 0 ? 'completed' : 'pending',
          created_at: now,
        });
      }
    }

    client.total_pending = Math.max(0, totalAmount - totalReceived);
    client.total_paid_fy = totalReceived;

    const stage = client.total_pending <= 0 ? 'Active Compliance' : 'GST Filing';
    const latestLifecycle = working.client_lifecycle.find((l: any) => l.client_id === client.id && l.current);
    if (latestLifecycle) latestLifecycle.current = false;
    working.client_lifecycle.push({
      id: genId(),
      client_id: client.id,
      stage,
      current: true,
      changed_at: now,
      batch_id: batchId,
    });

    for (const payment of clientData.payments || []) {
      const amount = Number(payment.amount || 0);
      const duplicate = working.payments.find((p: any) => p.client_id === client.client_id && p.date === payment.date && Number(p.payment) === amount);
      if (duplicate) {
        working.fraud_alerts.push({
          id: genId(),
          batch_id: batchId,
          type: 'duplicate_payment',
          client_id: client.id,
          message: `Duplicate payment detected for ${client.client_id}`,
          created_at: now,
        });
        continue;
      }

      if (amount > totalAmount) {
        working.fraud_alerts.push({
          id: genId(),
          batch_id: batchId,
          type: 'payment_exceeds_total',
          client_id: client.id,
          message: `Payment exceeds total fee for ${client.client_id}`,
          created_at: now,
        });
      }

      working.payments.push({
        id: genId(),
        financial_year: '2025-2026',
        date: payment.date,
        client_id: client.client_id,
        client_name: client.name,
        handler_code: client.handler_code,
        handler_id: client.handler_id,
        payment_mode: payment.mode,
        old_fee: 0,
        new_fee: 0,
        months_due: 1,
        due_amount: totalAmount,
        payment: amount,
        pending: Math.max(0, totalAmount - amount),
        reason: 'Upload sync',
        remarks: payment.reference || '',
        created_at: now,
      });
    }
  }

  working.audit_logs.push({
    id: genId(),
    user_id: employee.id,
    role: employee.role,
    action: 'upload',
    module: 'upload_batches',
    record_id: batchId,
    old_value: null,
    new_value: { clients: payload.clients.length, hash: payload.metadata.file_hash },
    timestamp: now,
  });

  await saveDB(working);

  return {
    batchId,
    processedClients: payload.clients.length,
    fraudAlerts: working.fraud_alerts.filter((f: any) => f.batch_id === batchId),
  };
}
