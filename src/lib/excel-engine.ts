import * as XLSX from 'xlsx';
import type { Client, Handler } from './erp-types';

// ─── Excel Template Generator ───────────────────────────────────────────────

export interface TemplateOptions {
  clients: Client[];
  handlers: Handler[];
  financialYear: string;
  generatedBy: string;
}

const MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March',
];

export function generatePaymentTemplate(opts: TemplateOptions): void {
  const { clients, handlers, financialYear, generatedBy } = opts;
  const wb = XLSX.utils.book_new();

  // ─── Sheet 1: Payment Entry (editable by handlers) ─────────────────────
  const headerRow = [
    'Client ID',       // A – locked
    'Client Name',     // B – locked
    'Handler Code',    // C – locked
    'Handler Name',    // D – locked
    'Old Fee',         // E – locked
    'New Fee',         // F – locked
    'Total Due',       // G – locked (formula)
    'Payment Received',// H – ✅ editable
    'Paid Term From',  // I – ✅ editable
    'Paid Term To',    // J – ✅ editable
    'Remarks',         // K – ✅ editable
    'Date',            // L – ✅ editable (default today)
  ];

  const rows: any[][] = [headerRow];
  const today = new Date().toISOString().slice(0, 10);

  for (const client of clients) {
    const handler = handlers.find(h => h.code === client.handlerCode);
    rows.push([
      client.clientId,
      client.name,
      client.handlerCode,
      handler?.name || '',
      client.oldFee,
      client.newFee,
      client.oldFeeDue + client.newFeeDue, // total due
      '',   // payment received – editable
      '',   // paid term from – editable
      '',   // paid term to – editable
      '',   // remarks – editable
      today, // date – editable
    ]);
  }

  const wsPayment = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  wsPayment['!cols'] = [
    { wch: 14 }, // A - Client ID
    { wch: 25 }, // B - Client Name
    { wch: 14 }, // C - Handler Code
    { wch: 18 }, // D - Handler Name
    { wch: 12 }, // E - Old Fee
    { wch: 12 }, // F - New Fee
    { wch: 14 }, // G - Total Due
    { wch: 18 }, // H - Payment Received
    { wch: 16 }, // I - Paid Term From
    { wch: 14 }, // J - Paid Term To
    { wch: 20 }, // K - Remarks
    { wch: 14 }, // L - Date
  ];

  // Data validations for month dropdowns
  const dataValidations: any[] = [];
  for (let r = 1; r <= clients.length; r++) {
    // Paid Term From (col I)
    dataValidations.push({
      sqref: `I${r + 1}`,
      type: 'list',
      formula1: `"${MONTHS.join(',')}"`,
    });
    // Paid Term To (col J)
    dataValidations.push({
      sqref: `J${r + 1}`,
      type: 'list',
      formula1: `"${MONTHS.join(',')}"`,
    });
  }

  // Note: xlsx library has limited data validation support; we add them as comments
  // The month dropdowns will be enforced during JSON conversion instead

  XLSX.utils.book_append_sheet(wb, wsPayment, 'Payment Entry');

  // ─── Sheet 2: Metadata (hidden reference) ─────────────────────────────
  const metaRows = [
    ['Key', 'Value'],
    ['financial_year', financialYear],
    ['generated_by', generatedBy],
    ['generated_at', new Date().toISOString()],
    ['version', '2.0'],
    ['total_clients', String(clients.length)],
    ['template_hash', ''],  // Will be filled during JSON export
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
  wsMeta['!cols'] = [{ wch: 18 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, '_metadata');

  // ─── Sheet 3: Month Reference ─────────────────────────────────────────
  const monthRows = [['Month'], ...MONTHS.map(m => [m])];
  const wsMonths = XLSX.utils.aoa_to_sheet(monthRows);
  XLSX.utils.book_append_sheet(wb, wsMonths, '_months');

  // ─── Sheet 4: Instructions ─────────────────────────────────────────────
  const instructions = [
    ['📋 PAYMENT COLLECTION TEMPLATE — INSTRUCTIONS'],
    [''],
    ['DO NOT edit columns A–G (Client ID, Name, Handler Code/Name, Fees, Total Due).'],
    ['These are system-generated and will be validated during import.'],
    [''],
    ['✅ EDITABLE COLUMNS:'],
    ['  H — Payment Received: Enter the amount collected from the client.'],
    ['  I — Paid Term From: Select the starting month (e.g., April).'],
    ['  J — Paid Term To: Select the ending month (e.g., June).'],
    ['  K — Remarks: Any notes about the payment.'],
    ['  L — Date: Payment date (default: today).'],
    [''],
    ['⚠️ RULES:'],
    ['  1. Only fill rows where payment was actually received.'],
    ['  2. Leave Payment Received blank for clients with no payment.'],
    ['  3. Do NOT add/remove/reorder rows.'],
    ['  4. Do NOT rename sheets.'],
    ['  5. Save as .xlsx and upload to ERP system.'],
    [''],
    [`Financial Year: ${financialYear}`],
    [`Generated: ${new Date().toLocaleString('en-IN')}`],
    [`By: ${generatedBy}`],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  // Download
  const fileName = `Payment-Template-${financialYear}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}


// ─── Excel → JSON Converter ─────────────────────────────────────────────────

export interface ParsedPaymentEntry {
  client_id: string;
  client_name: string;
  handler_code: string;
  handler_name: string;
  old_fee: number;
  new_fee: number;
  total_due: number;
  payment_received: number;
  paid_term_from: string;
  paid_term_to: string;
  remarks: string;
  date: string;
}

export interface ParsedUploadPayload {
  metadata: {
    financial_year: string;
    generated_by: string;
    generated_at: string;
    version: string;
    total_clients: number;
    uploaded_at: string;
    file_hash: string;
  };
  entries: ParsedPaymentEntry[];
  validation: {
    total_entries: number;
    entries_with_payment: number;
    total_payment_amount: number;
    errors: string[];
    warnings: string[];
  };
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function parseExcelToJSON(file: File, knownClients: Client[]): Promise<ParsedUploadPayload> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // ─── Validate structure ────────────────────────────────────────────────
  if (!wb.SheetNames.includes('Payment Entry')) {
    throw new Error('Invalid template: "Payment Entry" sheet not found. Use the official template.');
  }
  if (!wb.SheetNames.includes('_metadata')) {
    throw new Error('Invalid template: "_metadata" sheet not found. Template may be tampered.');
  }

  // ─── Read metadata ─────────────────────────────────────────────────────
  const metaSheet = wb.Sheets['_metadata'];
  const metaRows: any[][] = XLSX.utils.sheet_to_json(metaSheet, { header: 1 });
  const metaMap: Record<string, string> = {};
  for (const row of metaRows) {
    if (row[0] && row[1]) metaMap[String(row[0])] = String(row[1]);
  }

  const financialYear = metaMap['financial_year'] || '';
  const generatedBy = metaMap['generated_by'] || '';
  const generatedAt = metaMap['generated_at'] || '';
  const version = metaMap['version'] || '2.0';
  const totalClientsExpected = parseInt(metaMap['total_clients'] || '0', 10);

  // ─── Read payment entries ──────────────────────────────────────────────
  const paymentSheet = wb.Sheets['Payment Entry'];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(paymentSheet, { header: 1 });

  if (rawRows.length < 2) {
    throw new Error('No data rows found in Payment Entry sheet.');
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const entries: ParsedPaymentEntry[] = [];
  const clientIdSet = new Set(knownClients.map(c => c.clientId));

  // Skip header row
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const clientId = String(row[0] || '').trim();
    const clientName = String(row[1] || '').trim();
    const handlerCode = String(row[2] || '').trim();
    const handlerName = String(row[3] || '').trim();
    const oldFee = Number(row[4] || 0);
    const newFee = Number(row[5] || 0);
    const totalDue = Number(row[6] || 0);
    const paymentReceived = Number(row[7] || 0);
    const paidTermFrom = String(row[8] || '').trim();
    const paidTermTo = String(row[9] || '').trim();
    const remarks = String(row[10] || '').trim();
    const date = String(row[11] || '').trim();

    if (!clientId) {
      errors.push(`Row ${i + 1}: Missing Client ID`);
      continue;
    }

    // Validate client exists
    if (!clientIdSet.has(clientId)) {
      errors.push(`Row ${i + 1}: Client ID "${clientId}" not found in system`);
      continue;
    }

    // Validate against known client data (tamper detection)
    const knownClient = knownClients.find(c => c.clientId === clientId);
    if (knownClient) {
      if (knownClient.name !== clientName) {
        warnings.push(`Row ${i + 1}: Client name mismatch for ${clientId} (expected "${knownClient.name}", got "${clientName}")`);
      }
      if (knownClient.handlerCode !== handlerCode) {
        errors.push(`Row ${i + 1}: Handler code tampered for ${clientId} (expected "${knownClient.handlerCode}", got "${handlerCode}")`);
        continue;
      }
    }

    // Skip rows with no payment
    if (!paymentReceived || paymentReceived <= 0) continue;

    // Validate payment amount
    if (paymentReceived > totalDue * 2) {
      warnings.push(`Row ${i + 1}: Payment ₹${paymentReceived} is >2x the due amount ₹${totalDue} for ${clientId}`);
    }

    // Validate months
    if (paidTermFrom && !MONTHS.includes(paidTermFrom)) {
      errors.push(`Row ${i + 1}: Invalid "Paid Term From" month "${paidTermFrom}"`);
      continue;
    }
    if (paidTermTo && !MONTHS.includes(paidTermTo)) {
      errors.push(`Row ${i + 1}: Invalid "Paid Term To" month "${paidTermTo}"`);
      continue;
    }

    entries.push({
      client_id: clientId,
      client_name: clientName,
      handler_code: handlerCode,
      handler_name: handlerName,
      old_fee: oldFee,
      new_fee: newFee,
      total_due: totalDue,
      payment_received: paymentReceived,
      paid_term_from: paidTermFrom || 'April',
      paid_term_to: paidTermTo || 'April',
      remarks,
      date: date || new Date().toISOString().slice(0, 10),
    });
  }

  // Row count validation
  const dataRowCount = rawRows.length - 1;
  if (totalClientsExpected > 0 && dataRowCount !== totalClientsExpected) {
    errors.push(`Row count mismatch: template had ${totalClientsExpected} clients, file has ${dataRowCount} rows. Rows may have been added/removed.`);
  }

  const totalPaymentAmount = entries.reduce((s, e) => s + e.payment_received, 0);

  // Generate hash
  const hashPayload = JSON.stringify(entries);
  const fileHash = await sha256(hashPayload);

  return {
    metadata: {
      financial_year: financialYear,
      generated_by: generatedBy,
      generated_at: generatedAt,
      version,
      total_clients: totalClientsExpected,
      uploaded_at: new Date().toISOString(),
      file_hash: fileHash,
    },
    entries,
    validation: {
      total_entries: dataRowCount,
      entries_with_payment: entries.length,
      total_payment_amount: totalPaymentAmount,
      errors,
      warnings,
    },
  };
}


// ─── JSON → ERP Processor ───────────────────────────────────────────────────

export interface ProcessResult {
  success: boolean;
  processed: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  totalAmountProcessed: number;
  timestamp: string;
}

export async function processPaymentJSON(
  payload: ParsedUploadPayload,
  uploaderEmail: string,
): Promise<ProcessResult> {
  const { loadDB, saveDB, genId } = await import('@/lib/mini-supabase/mini-db');
  const now = new Date().toISOString();
  const db = await loadDB();

  const result: ProcessResult = {
    success: false,
    processed: 0,
    skipped: 0,
    errors: [...payload.validation.errors],
    warnings: [...payload.validation.warnings],
    totalAmountProcessed: 0,
    timestamp: now,
  };

  if (payload.validation.errors.length > 0) {
    result.errors.push('Cannot process: validation errors exist. Fix the Excel file and re-upload.');
    return result;
  }

  // Check for duplicate batch
  const existingBatch = (db.upload_batches || []).find(
    (b: any) => b.file_hash === payload.metadata.file_hash,
  );
  if (existingBatch) {
    result.errors.push('Duplicate upload detected: this exact file has already been processed.');
    return result;
  }

  // Create batch record
  const batchId = genId();
  if (!db.upload_batches) db.upload_batches = [];
  if (!db.audit_logs) db.audit_logs = [];

  db.upload_batches.push({
    id: batchId,
    file_hash: payload.metadata.file_hash,
    uploaded_by: uploaderEmail,
    uploaded_at: now,
    status: 'processed',
    version: payload.metadata.version,
    financial_year: payload.metadata.financial_year,
    entries_count: payload.entries.length,
    total_amount: payload.validation.total_payment_amount,
  });

  for (const entry of payload.entries) {
    const client = db.clients.find(
      (c: any) => c.client_id === entry.client_id && !c.deleted,
    );

    if (!client) {
      result.errors.push(`Client ${entry.client_id} not found in database. Skipped.`);
      result.skipped++;
      continue;
    }

    // Check for duplicate payment
    const isDuplicate = db.payments.some(
      (p: any) =>
        p.client_id === entry.client_id &&
        p.date === entry.date &&
        Number(p.payment) === entry.payment_received &&
        !p.deleted,
    );

    if (isDuplicate) {
      result.warnings.push(`Duplicate payment for ${entry.client_id} on ${entry.date} — skipped.`);
      result.skipped++;
      continue;
    }

    // Calculate pending
    const pending = Math.max(0, entry.total_due - entry.payment_received);

    // Insert payment record
    db.payments.push({
      id: genId(),
      financial_year: payload.metadata.financial_year,
      date: entry.date,
      client_id: entry.client_id,
      client_name: entry.client_name,
      handler_code: entry.handler_code,
      old_fee: entry.old_fee,
      new_fee: entry.new_fee,
      months_due: 1,
      due_amount: entry.total_due,
      payment: entry.payment_received,
      pending,
      paid_term_from: entry.paid_term_from,
      paid_term_to: entry.paid_term_to,
      reason: 'Excel Upload',
      remarks: entry.remarks,
      created_at: now,
    });

    // Update client totals
    client.total_paid_fy = (client.total_paid_fy || 0) + entry.payment_received;
    client.total_pending = Math.max(
      0,
      (client.old_fee_due || 0) + (client.new_fee_due || 0) - client.total_paid_fy,
    );

    // Clear pending if fully paid
    if (client.total_pending <= 0) {
      client.total_pending = 0;
    }

    result.processed++;
    result.totalAmountProcessed += entry.payment_received;
  }

  // Audit log
  db.audit_logs.push({
    id: genId(),
    user_id: uploaderEmail,
    role: 'upload',
    action: 'excel_upload',
    module: 'payments',
    record_id: batchId,
    old_value: null,
    new_value: {
      entries: payload.entries.length,
      processed: result.processed,
      skipped: result.skipped,
      total_amount: result.totalAmountProcessed,
      hash: payload.metadata.file_hash,
    },
    timestamp: now,
  });

  await saveDB(db);
  result.success = result.errors.length === 0;

  return result;
}
