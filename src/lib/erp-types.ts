export interface Handler {
  id: string;
  code: string;
  name: string;
  active: boolean;
  userId?: string | null;
}

export interface Client {
  id: string;
  clientId: string;
  name: string;
  phone: string;
  gstNumber: string;
  pan?: string;
  status?: 'active' | 'inactive';
  handlerCode: string;
  oldFee: number;
  oldFeeEndMonth: string;
  oldFeeDue: number;
  newFee: number;
  newFeeStartMonth: string;
  newFeeDue: number;
  totalPaidFY: number;
  totalPending: number;
  paidTerm: string;
  financialYear: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  financialYear: string;
  date: string;
  clientId: string;
  clientName: string;
  handlerCode: string;
  paymentMode?: string;
  editHistory?: { action: string; at: string; by?: string }[];
  oldFee: number;
  newFee: number;
  paidTermFrom: string;
  paidTermTo: string;
  dueAmount: number;
  payment: number;
  pending: number;
  reason: string;
  remarks: string;
  approvalStatus?: string;
  approvedBy?: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  handlerCode: string;
  status?: 'draft' | 'paid' | 'pending';
  items: InvoiceItem[];
  subtotal: number;
  gst: number;
  total: number;
  financialYear: string;
}

export interface InvoiceItem {
  description: string;
  amount: number;
}

export const HANDLERS: Handler[] = [
  
];

// Dynamic FY list — will be populated from storage
// Default static list as fallback
export const DEFAULT_FINANCIAL_YEARS = [
  '2024-2025',
  '2025-2026',
  '2026-2027',
];

// Keep for backward compat — components should use getAvailableFYs() instead
export const FINANCIAL_YEARS = DEFAULT_FINANCIAL_YEARS;

export const MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March'
];
