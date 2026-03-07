import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { miniDB, miniAuth, loadDB, saveDB } from '@/lib/mini-supabase';
import { Client, Payment, Invoice, HANDLERS, Handler } from './erp-types';
import { useAuth } from '@/hooks/useAuth';

type ModuleName = 'clients' | 'payments' | 'invoices' | 'handlers';
type ActionName = 'create' | 'update' | 'delete' | 'restore';

const PERMISSION_MATRIX: Record<'admin' | 'manager' | 'handler' | 'viewer', Record<ModuleName, Partial<Record<ActionName, boolean>>>> = {
  admin: {
    clients: { create: true, update: true, delete: true, restore: true },
    payments: { create: true, update: true, delete: true, restore: true },
    invoices: { create: true, update: true, delete: true, restore: true },
    handlers: { create: true },
  },
  manager: {
    clients: { create: true, update: true, delete: true, restore: true },
    payments: { create: true, update: true, delete: true, restore: true },
    invoices: { create: true, update: true, delete: true, restore: true },
    handlers: { create: true },
  },
  handler: {
    clients: { create: true, update: true, delete: true },
    payments: { create: true, update: true, delete: true },
    invoices: { create: true, update: true, delete: false },
    handlers: {},
  },
  viewer: {
    clients: {},
    payments: {},
    invoices: {},
    handlers: {},
  },
};

interface ERPContextType {
  clients: Client[];
  payments: Payment[];
  invoices: Invoice[];
  handlers: Handler[];
  currentFY: string;
  loading: boolean;
  setCurrentFY: (fy: string) => void;
  addClient: (client: Omit<Client, 'id' | 'totalPaidFY' | 'totalPending' | 'paidTerm' | 'createdAt'>) => Promise<void>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  removeClientWithAuth: (id: string, password: string) => Promise<void>;
  restoreClient: (id: string) => Promise<void>;
  addPayment: (payment: Omit<Payment, 'id' | 'pending'>) => Promise<void>;
  removePayment: (id: string) => Promise<void>;
  restorePayment: (id: string) => Promise<void>;
  addInvoice: (invoice: Omit<Invoice, 'id'>) => Promise<void>;
  removeInvoice: (id: string) => Promise<void>;
  restoreInvoice: (id: string) => Promise<void>;
  getClientsByHandler: (handlerCode: string) => Client[];
  getPaymentsByHandler: (handlerCode: string) => Payment[];
  getHandlerStats: (handlerCode: string) => { totalClients: number; totalCollected: number; totalPending: number };
  getDashboardStats: () => { totalClients: number; totalRevenue: number; totalPending: number; totalCollected: number; handlerPerformance: { code: string; name: string; clients: number; collected: number; pending: number; completionRate: string }[] };
  getHandlerDashboardStats: () => { assignedClients: number; totalPaymentsHandled: number; pendingChecklistCount: number; recentInvoices: Invoice[] };
  refreshData: () => Promise<void>;
}

const ERPContext = createContext<ERPContextType | null>(null);

export function ERPProvider({ children }: { children: ReactNode }) {
  const { role, user, loading: authLoading, handlerCode } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [handlers, setHandlers] = useState<Handler[]>(HANDLERS);
  const [currentFY, setCurrentFY] = useState('2025-2026');
  const [loading, setLoading] = useState(true);

  const can = (module: ModuleName, action: ActionName) => {
    if (!role || role === 'none') return false;
    return !!PERMISSION_MATRIX[role][module]?.[action];
  };

  const logAudit = async (action: string, module: string, recordId: string) => {
    if (!user || !role || role === 'none') return;
    await miniDB.from('audit_logs').insert({
      user_id: user.id,
      role,
      action,
      module,
      record_id: recordId,
      timestamp: new Date().toISOString(),
    });
  };

  const fetchData = useCallback(async () => {
    if (authLoading || !user || !role || role === 'none') {
      return;
    }

    setLoading(true);
    try {
      const handlerId = user?.handler_id;
      const isHandler = role === 'handler' && handlerId;

      const clientsQuery = miniDB.from('clients').select('*').order('created_at', { ascending: false });
      const paymentsQuery = miniDB.from('payments').select('*').order('created_at', { ascending: false });
      const invoicesQuery = miniDB.from('invoices').select('*, invoice_items(*)').order('created_at', { ascending: false });
      const handlersQuery = miniDB.from('handlers').select('*').order('code');

      if (isHandler) {
        clientsQuery.eq('handler_id', handlerId);
        paymentsQuery.eq('handler_id', handlerId);
        invoicesQuery.eq('handler_id', handlerId);
      }

      const [clientsRes, paymentsRes, invoicesRes, handlersRes] = await Promise.all([
        clientsQuery,
        paymentsQuery,
        invoicesQuery,
        handlersQuery,
      ]);

      if (clientsRes.data) {
        setClients(clientsRes.data.map((c: any) => ({
          id: c.id,
          clientId: c.client_id,
          name: c.name,
          phone: c.phone,
          gstNumber: c.gst_number || '',
          pan: c.pan || '',
          status: c.status || 'active',
          handlerCode: c.handler_code,
          oldFee: Number(c.old_fee),
          oldFeeEndMonth: c.old_fee_end_month,
          oldFeeDue: Number(c.old_fee_due),
          newFee: Number(c.new_fee),
          newFeeStartMonth: c.new_fee_start_month,
          newFeeDue: Number(c.new_fee_due),
          totalPaidFY: Number(c.total_paid_fy),
          totalPending: Number(c.total_pending),
          paidTerm: c.paid_term,
          financialYear: c.financial_year,
          createdAt: c.created_at,
        })));
      }

      if (paymentsRes.data) {
        setPayments(paymentsRes.data.map((p: any) => ({
          id: p.id,
          financialYear: p.financial_year,
          date: p.date,
          clientId: p.client_id,
          clientName: p.client_name,
          handlerCode: p.handler_code,
          paymentMode: p.payment_mode || 'cash',
          editHistory: p.edit_history || [],
          oldFee: Number(p.old_fee),
          newFee: Number(p.new_fee),
          paidTermFrom: p.paid_term_from || 'April',
          paidTermTo: p.paid_term_to || 'April',
          dueAmount: Number(p.due_amount),
          payment: Number(p.payment),
          pending: Number(p.pending),
          reason: p.reason,
          remarks: p.remarks,
          approvalStatus: p.approval_status || 'pending_approval',
          approvedBy: p.approved_by || '',
        })));
      }

      if (invoicesRes.data) {
        setInvoices(invoicesRes.data.map((inv: any) => ({
          id: inv.id,
          invoiceNo: inv.invoice_no,
          date: inv.date,
          clientId: inv.client_id,
          clientName: inv.client_name,
          clientPhone: inv.client_phone,
          handlerCode: inv.handler_code,
          status: inv.status || 'pending',
          items: (inv.invoice_items || []).map((it: any) => ({ description: it.description, amount: Number(it.amount) })),
          subtotal: Number(inv.subtotal),
          gst: Number(inv.gst),
          total: Number(inv.total),
          financialYear: inv.financial_year,
        })));
      }

      if (handlersRes.data) {
        setHandlers(handlersRes.data.map((h: any) => ({
          id: h.id,
          code: h.code,
          name: h.name,
          active: h.active,
          userId: h.user_id,
        })));
      }
    } catch (err) {
      console.error('Error fetching ERP data:', err);
    } finally {
      setLoading(false);
    }
  }, [authLoading, role, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'erp_sync_event') fetchData();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [fetchData]);

  const getHandlerUserId = (selectedHandlerCode: string) =>
    handlers.find((h) => h.code === selectedHandlerCode)?.userId ?? null;

  const canModifyClient = (clientId: string) => {
    if (!can('clients', 'update') && !can('clients', 'delete')) return false;
    if (role === 'admin' || role === 'manager') return true;
    const client = clients.find((c) => c.id === clientId);
    return !!(client && user?.handler_id && client.handlerCode === handlerCode);
  };

  const addClient = async (client: Omit<Client, 'id' | 'totalPaidFY' | 'totalPending' | 'paidTerm' | 'createdAt'>) => {
    if (!can('clients', 'create')) throw new Error('You do not have permission to create clients.');

    const allowedHandlerCode = role === 'handler' ? handlerCode : client.handlerCode;
    const { data, error } = await miniDB.from('clients').insert({
      client_id: client.clientId,
      name: client.name,
      phone: client.phone,
      gst_number: client.gstNumber,
      pan: client.pan || '',
      status: client.status || 'active',
      handler_code: allowedHandlerCode,
      old_fee: client.oldFee,
      old_fee_end_month: client.oldFeeEndMonth,
      old_fee_due: client.oldFeeDue,
      new_fee: client.newFee,
      new_fee_start_month: client.newFeeStartMonth,
      new_fee_due: client.newFeeDue,
      total_pending: client.oldFeeDue + client.newFeeDue,
      total_paid_fy: 0, 
      paid_term: '',
      financial_year: client.financialYear,
      handler_id: role === 'handler' ? user?.handler_id : getHandlerUserId(allowedHandlerCode || client.handlerCode),
    });
    if (error) throw error;
    if (data?.[0]?.id) await logAudit('create', 'clients', data[0].id);
    await fetchData();
  };

  const updateClient = async (id: string, data: Partial<Client>) => {
    if (!canModifyClient(id)) throw new Error('You do not have permission to update clients.');

    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.gstNumber !== undefined) update.gst_number = data.gstNumber;
    if (data.pan !== undefined) update.pan = data.pan;
    if (data.status !== undefined) update.status = data.status;
    if (data.handlerCode !== undefined && role === 'admin') {
      update.handler_code = data.handlerCode;
      update.handler_id = getHandlerUserId(data.handlerCode);
    }
    if (data.oldFee !== undefined) update.old_fee = data.oldFee;
    if (data.newFee !== undefined) update.new_fee = data.newFee;
    if (data.oldFeeDue !== undefined) update.old_fee_due = data.oldFeeDue;
    if (data.newFeeDue !== undefined) update.new_fee_due = data.newFeeDue;

    const { error } = await miniDB.from('clients').update(update).eq('id', id);
    if (error) throw error;
    await logAudit('update', 'clients', id);
    await fetchData();
  };

  const removeClient = async (id: string) => {
    if (!can('clients', 'delete') || !canModifyClient(id)) throw new Error('You do not have permission to remove clients.');
    const { error } = await miniDB.from('clients').delete().eq('id', id);
    if (error) throw error;
    await logAudit('delete', 'clients', id);
    await fetchData();
  };

  const removeClientWithAuth = async (id: string, password: string) => {
    if (!user?.email) throw new Error('No active user session.');
    const { error: authError } = await miniAuth.signIn(user.email, password);
    if (authError) throw new Error('Authentication failed. Please verify your password.');
    await removeClient(id);
  };

  const restoreClient = async (id: string) => {
    if (!can('clients', 'restore')) throw new Error('You do not have permission to restore clients.');
    const { error } = await miniDB.from('clients').update({ deleted: false, deleted_at: null }).eq('id', id);
    if (error) throw error;
    await logAudit('restore', 'clients', id);
    await fetchData();
  };

  const addPayment = async (payment: Omit<Payment, 'id' | 'pending'>) => {
  if (!can('payments', 'create')) throw new Error('You do not have permission to record payments.');

  const safeHandlerCode = role === 'handler' ? handlerCode : payment.handlerCode;
  const pending = Math.max(0, payment.dueAmount - payment.payment);

  const { data, error } = await miniDB.from('payments').insert({
    financial_year: payment.financialYear,
    date: payment.date,
    client_id: payment.clientId,
    client_name: payment.clientName,
    handler_code: safeHandlerCode,
    payment_mode: payment.paymentMode || 'cash',
    edit_history: payment.editHistory || [],
    old_fee: payment.oldFee,
    new_fee: payment.newFee,
    paid_term_from: payment.paidTermFrom,
    paid_term_to: payment.paidTermTo,
    due_amount: payment.dueAmount,
    payment: payment.payment,
    pending,
    reason: payment.reason,
    remarks: payment.remarks,
    handler_id: role === 'handler'
      ? user?.handler_id
      : getHandlerUserId(safeHandlerCode || payment.handlerCode),
    approval_status: 'pending_approval',
  });

  if (error) throw error;

  if (data?.[0]?.id) {
    await logAudit('create', 'payments', data[0].id);
  }

  // 🔥 LEDGER RECALCULATION
  const client = clients.find(c => c.clientId === payment.clientId);

  if (client) {
    const totalFees =
      Number(client.oldFeeDue || 0) +
      Number(client.newFeeDue || 0);

    const totalPaid =
      Number(client.totalPaidFY || 0) +
      Number(payment.payment || 0);

    const newPending = Math.max(0, totalFees - totalPaid);

    await miniDB
      .from('clients')
      .update({
        total_paid_fy: totalPaid,
        total_pending: newPending,
      })
      .eq('client_id', payment.clientId);
  }

  await fetchData();
  };
  const removePayment = async (id: string) => {
    if (!can('payments', 'delete')) throw new Error('You do not have permission to delete payments.');
    const { error } = await miniDB.from('payments').delete().eq('id', id);
    if (error) throw error;
    await logAudit('delete', 'payments', id);
    await fetchData();
  };

  const restorePayment = async (id: string) => {
    if (!can('payments', 'restore')) throw new Error('You do not have permission to restore payments.');
    const { error } = await miniDB.from('payments').update({ deleted: false, deleted_at: null }).eq('id', id);
    if (error) throw error;
    await logAudit('restore', 'payments', id);
    await fetchData();
  };

  const addInvoice = async (invoice: Omit<Invoice, 'id'>) => {
    if (!can('invoices', 'create')) throw new Error('You do not have permission to create invoices.');

    const safeHandlerCode = role === 'handler' ? handlerCode : invoice.handlerCode;
    const fyInvoices = invoices.filter((i) => i.financialYear === invoice.financialYear);
    const autoNumber = `INV-${invoice.financialYear.split('-')[0]}-${String(fyInvoices.length + 1).padStart(4, '0')}`;
    const invoiceNo = invoice.invoiceNo?.trim() || autoNumber;
    const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
    const gst = Number((subtotal * 0.18).toFixed(2));
    const total = Number((subtotal + gst).toFixed(2));

    const { data, error } = await miniDB.from('invoices').insert({
      invoice_no: invoiceNo,
      date: invoice.date,
      client_id: invoice.clientId,
      client_name: invoice.clientName,
      client_phone: invoice.clientPhone,
      handler_code: safeHandlerCode,
      status: invoice.status || 'pending',
      subtotal,
      gst,
      total,
      financial_year: invoice.financialYear,
      handler_id: role === 'handler' ? user?.handler_id : getHandlerUserId(safeHandlerCode || invoice.handlerCode),
    });
    if (error) throw error;

    const insertedInvoice = data?.[0];

    if (insertedInvoice && invoice.items.length > 0) {
      await miniDB.from('invoice_items').insert(
        invoice.items.map(item => ({
          invoice_id: insertedInvoice.id,
          description: item.description,
          amount: item.amount,
        }))
      );
      await logAudit('create', 'invoices', insertedInvoice.id);
    }
    await fetchData();
  };

  const removeInvoice = async (id: string) => {
    if (!can('invoices', 'delete')) throw new Error('You do not have permission to delete invoices.');
    const { error } = await miniDB.from('invoices').delete().eq('id', id);
    if (error) throw error;
    await logAudit('delete', 'invoices', id);
    await fetchData();
  };

  const restoreInvoice = async (id: string) => {
    if (!can('invoices', 'restore')) throw new Error('You do not have permission to restore invoices.');
    const db = await loadDB();
    const target = db.invoices.find((i: any) => i.id === id);
    if (!target) throw new Error('Invoice not found');
    target.deleted = false;
    target.deleted_at = null;
    db.invoice_items = db.invoice_items.map((it: any) => it.invoice_id === id ? { ...it, deleted: false, deleted_at: null } : it);
    await saveDB(db);
    await logAudit('restore', 'invoices', id);
    await fetchData();
  };

  const getClientsByHandler = (selectedHandlerCode: string) => clients.filter(c => c.handlerCode === selectedHandlerCode && c.financialYear === currentFY);
  const getPaymentsByHandler = (selectedHandlerCode: string) => payments.filter(p => p.handlerCode === selectedHandlerCode && p.financialYear === currentFY);

  const getHandlerStats = (selectedHandlerCode: string) => {
    const hClients = getClientsByHandler(selectedHandlerCode);
    return {
      totalClients: hClients.length,
      totalCollected: hClients.reduce((s, c) => s + c.totalPaidFY, 0),
      totalPending: hClients.reduce((s, c) => s + c.totalPending, 0),
    };
  };

  const getDashboardStats = () => {
    const fyClients = clients.filter(c => c.financialYear === currentFY);
    const fyPayments = payments.filter(p => p.financialYear === currentFY);

    const monthlyRevenueMap = new Map<string, number>();
    fyPayments.forEach((p) => {
      const month = (p.date || '').slice(0, 7);
      monthlyRevenueMap.set(month, (monthlyRevenueMap.get(month) || 0) + p.payment);
    });

    return {
      totalClients: fyClients.length,
      totalRevenue: fyClients.reduce((s, c) => s + c.oldFeeDue + c.newFeeDue, 0),
      totalPending: fyClients.reduce((s, c) => s + c.totalPending, 0),
      totalCollected: fyPayments.reduce((s, p) => s + p.payment, 0),
      monthlyRevenue: Array.from(monthlyRevenueMap.entries()).map(([month, amount]) => ({ month, amount })),
      invoiceCount: invoices.filter((i) => i.financialYear === currentFY).length,
      paymentTrends: fyPayments.length,
      handlerPerformance: handlers.map(h => {
        const hClients = fyClients.filter(c => c.handlerCode === h.code);
        const assigned = hClients.length;
        const completed = hClients.filter((c) => c.totalPending <= 0).length;
        return {
          code: h.code,
          name: h.name,
          clients: assigned,
          collected: hClients.reduce((s, c) => s + c.totalPaidFY, 0),
          pending: hClients.reduce((s, c) => s + c.totalPending, 0),
          completionRate: assigned ? `${((completed / assigned) * 100).toFixed(1)}%` : '0%',
        };
      }),
    } as any;
  };

  const getHandlerDashboardStats = () => {
    const scopedClients = role === 'handler'
      ? clients.filter((c) => c.handlerCode === handlerCode && c.financialYear === currentFY)
      : clients.filter((c) => c.financialYear === currentFY);
    const scopedPayments = role === 'handler'
      ? payments.filter((p) => p.handlerCode === handlerCode && p.financialYear === currentFY)
      : payments.filter((p) => p.financialYear === currentFY);
    const scopedInvoices = role === 'handler'
      ? invoices.filter((i) => i.handlerCode === handlerCode && i.financialYear === currentFY)
      : invoices.filter((i) => i.financialYear === currentFY);

    return {
      assignedClients: scopedClients.length,
      totalPaymentsHandled: scopedPayments.length,
      pendingChecklistCount: scopedClients.filter((c) => c.totalPending > 0).length,
      recentInvoices: [...scopedInvoices]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    };
  };

  return (
    <ERPContext.Provider value={{
      clients, payments, invoices, handlers, currentFY, loading,
      setCurrentFY, addClient, updateClient, removeClient, removeClientWithAuth, restoreClient, addPayment, removePayment, restorePayment, addInvoice, removeInvoice, restoreInvoice,
      getClientsByHandler, getPaymentsByHandler, getHandlerStats, getDashboardStats, getHandlerDashboardStats,
      refreshData: fetchData,
    }}>
      {children}
    </ERPContext.Provider>
  );
}

export function useERP() {
  const ctx = useContext(ERPContext);
  if (!ctx) throw new Error('useERP must be used within ERPProvider');
  return ctx;
}

export const resetERPDatabase = () => {

  const resetData = {
    clients: [],
    payments: [],
    invoices: [],
    pendingChecklist: [],
    reports: [],
    uploads: [],
    approvals: [],
    auditLogs: [],
    collections: [],
    riskDetection: [],
    aiPlanner: [],
    excelSync: []
  };

  localStorage.setItem("erp-data", JSON.stringify(resetData));

};
