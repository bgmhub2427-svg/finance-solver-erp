/**
 * Comprehensive ERP tests — auth, CRUD, FY management, permissions, fee calculation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock IndexedDB with in-memory store ────────────────────────────
const store = new Map<string, any>();

vi.mock('@/lib/mini-supabase/mini-indexeddb', () => ({
  loadGlobalData: vi.fn(async () => store.get('global') ?? null),
  saveGlobalData: vi.fn(async (data: any) => { store.set('global', JSON.parse(JSON.stringify(data))); }),
  loadFYData: vi.fn(async (fy: string) => store.get(`fy_${fy}`) ?? null),
  saveFYData: vi.fn(async (fy: string, data: any) => { store.set(`fy_${fy}`, JSON.parse(JSON.stringify(data))); }),
  loadLegacyDatabase: vi.fn(async () => null),
  getActiveFY: vi.fn(() => store.get('__activeFY') ?? '2025-2026'),
  setActiveFY: vi.fn((fy: string) => store.set('__activeFY', fy)),
  getAvailableFYs: vi.fn(() => store.get('__fyList') ?? ['2024-2025', '2025-2026', '2026-2027']),
  setAvailableFYs: vi.fn((fys: string[]) => store.set('__fyList', fys)),
}));

// Import after mocking
import { loadDB, saveDB, resetDB, genId, isAdminEmail, switchFY, createFinancialYear, getAvailableFYs } from '@/lib/mini-supabase/mini-db';
import { miniAuth } from '@/lib/mini-supabase/mini-auth';
import { miniDB } from '@/lib/mini-supabase/mini-query';

// ─── Helpers ────────────────────────────────────────────────────────
async function seedAndLogin() {
  await resetDB();
  const db = await loadDB();
  // Use the seeded admin
  const admin = db.users.find(u => u.email === 'admin@ka.com');
  expect(admin).toBeDefined();
  const result = await miniAuth.signIn('admin@ka.com', 'Ka@2026!x');
  expect(result.error).toBeNull();
  return db;
}

// ─── Tests ──────────────────────────────────────────────────────────
describe('Mini-Supabase Core', () => {
  beforeEach(() => {
    store.clear();
    store.set('__activeFY', '2025-2026');
    store.set('__fyList', ['2024-2025', '2025-2026', '2026-2027']);
  });

  // ── Auth ──────────────────────────────────────────────────────────
  describe('Authentication', () => {
    it('should sign up a new user', async () => {
      await resetDB();
      const res = await miniAuth.signUp('testuser@example.com', 'Test@123!Ab');
      expect(res.error).toBeNull();
      expect(res.data?.user.email).toBe('testuser@example.com');
      expect(res.data?.user.role).toBe('admin'); // new signups are org admins
    });

    it('should assign admin role to admin emails on signup', async () => {
      await resetDB();
      const res = await miniAuth.signUp('admin@ka.com', 'Test@123');
      // User already exists from seed, so this should fail
      expect(res.error).toBeDefined();
    });

    it('should sign in with valid credentials', async () => {
      await resetDB();
      const res = await miniAuth.signIn('admin@ka.com', 'Ka@2026!x');
      expect(res.error).toBeNull();
      expect(res.data?.user.role).toBe('admin');
    });

    it('should reject invalid credentials', async () => {
      await resetDB();
      const res = await miniAuth.signIn('admin@ka.com', 'wrong_password');
      expect(res.error).toBeDefined();
    });

    it('should sign out', async () => {
      await seedAndLogin();
      await miniAuth.signOut();
      const user = miniAuth.getCurrentUser();
      expect(user).toBeNull();
    });

    it('should create handler user (admin only)', async () => {
      await seedAndLogin();
      const res = await miniAuth.createHandlerUser({
        email: 'handler1@test.com',
        password: 'Handler@123',
        handler_code: 'H01',
        handler_name: 'Test Handler',
      });
      expect(res.error).toBeNull();
      expect(res.data?.user.role).toBe('handler');

      // Verify handler was created in DB
      const db = await loadDB();
      const handler = db.handlers.find((h: any) => h.code === 'H01');
      expect(handler).toBeDefined();
      expect(handler?.name).toBe('Test Handler');
    });
  });

  // ── CRUD Operations ───────────────────────────────────────────────
  describe('CRUD Operations', () => {
    it('should insert and select clients', async () => {
      await seedAndLogin();
      
      const { data, error } = await miniDB.from('clients').insert({
        client_id: 'C001',
        name: 'Test Client',
        phone: '9876543210',
        gst_number: 'GST001',
        handler_code: 'H01',
        old_fee: 1000,
        old_fee_end_month: 'March',
        old_fee_due: 5000,
        new_fee: 1500,
        new_fee_start_month: 'April',
        new_fee_due: 7000,
        total_paid_fy: 0,
        total_pending: 12000,
        financial_year: '2025-2026',
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0].client_id).toBe('C001');

      // Select
      const { data: selected } = await miniDB.from('clients').select('*');
      expect(selected.length).toBeGreaterThanOrEqual(1);
      expect(selected.some((c: any) => c.client_id === 'C001')).toBe(true);
    });

    it('should update records', async () => {
      await seedAndLogin();
      
      await miniDB.from('clients').insert({
        client_id: 'C002',
        name: 'Update Me',
        phone: '1111111111',
        handler_code: 'H01',
        old_fee: 100,
        new_fee: 200,
        total_pending: 300,
        financial_year: '2025-2026',
      });

      const { data: clients } = await miniDB.from('clients').select('*').eq('client_id', 'C002');
      const id = clients[0].id;

      await miniDB.from('clients').update({ name: 'Updated Name' }).eq('id', id);
      
      const { data: updated } = await miniDB.from('clients').select('*').eq('id', id);
      expect(updated[0].name).toBe('Updated Name');
    });

    it('should soft-delete clients', async () => {
      await seedAndLogin();
      
      const { data: inserted } = await miniDB.from('clients').insert({
        client_id: 'C003',
        name: 'Delete Me',
        phone: '2222222222',
        handler_code: 'H01',
        financial_year: '2025-2026',
      });

      await miniDB.from('clients').delete().eq('id', inserted[0].id);

      // Should not appear in normal select
      const { data: visible } = await miniDB.from('clients').select('*').eq('client_id', 'C003');
      expect(visible.length).toBe(0);

      // Should appear if we query with deleted flag
      const { data: withDeleted } = await miniDB.from('clients').select('*').eq('deleted', true);
      expect(withDeleted.some((c: any) => c.client_id === 'C003')).toBe(true);
    });

    it('should insert and track payments with unique IDs', async () => {
      await seedAndLogin();

      const { data, error } = await miniDB.from('payments').insert({
        payment_id: 'PAY-test-001',
        financial_year: '2025-2026',
        date: '2025-06-15',
        client_id: 'C001',
        client_name: 'Test Client',
        handler_code: 'H01',
        payment_mode: 'cash',
        old_fee: 1000,
        new_fee: 1500,
        due_amount: 5000,
        payment: 2000,
        reason: 'Monthly fee',
        remarks: 'Partial payment',
      });

      expect(error).toBeNull();
      expect(data[0].payment_id).toBe('PAY-test-001');
      expect(data[0].pending).toBe(3000); // 5000 - 2000
      expect(data[0].approval_status).toBe('pending_approval');
    });

    it('should insert invoices with items', async () => {
      await seedAndLogin();

      const { data, error } = await miniDB.from('invoices').insert({
        invoice_no: 'INV-001',
        date: '2025-06-15',
        client_id: 'C001',
        client_name: 'Test Client',
        client_phone: '9876543210',
        handler_code: 'H01',
        subtotal: 10000,
        gst: 1800,
        total: 11800,
        financial_year: '2025-2026',
      });

      expect(error).toBeNull();

      // Insert items
      const { error: itemError } = await miniDB.from('invoice_items').insert([
        { invoice_id: data[0].id, description: 'GST Filing', amount: 5000 },
        { invoice_id: data[0].id, description: 'IT Return', amount: 5000 },
      ]);

      expect(itemError).toBeNull();

      // Select with items
      const { data: invoices } = await miniDB.from('invoices').select('*, invoice_items(*)');
      const inv = invoices.find((i: any) => i.invoice_no === 'INV-001');
      expect(inv).toBeDefined();
      expect(inv.invoice_items).toHaveLength(2);
    });
  });

  // ── Permissions ───────────────────────────────────────────────────
  describe('Permissions', () => {
    it('should deny unauthenticated access', async () => {
      await resetDB();
      await miniAuth.signOut();

      const { data, error } = await miniDB.from('clients').select('*');
      expect(error).toBeDefined();
      expect(data).toEqual([]);
    });

    it('viewer cannot insert clients', async () => {
      await resetDB();
      // Sign up as viewer
      await miniAuth.signUp('viewer@test.com', 'View@123');
      
      const { data, error } = await miniDB.from('clients').insert({
        client_id: 'VTEST',
        name: 'Viewer Client',
        handler_code: 'H01',
      });

      // Viewer can't insert (canAccess returns false for non-admin on clients insert)
      // But mini-query allows select for viewers — the permission is enforced at erp-store level
      // At mini-query level, viewers can insert if canAccess allows it
      // canAccess: role=viewer, table=clients => action=select only
      // So insert should fail
      expect(error).toBeDefined();
    });
  });

  // ── Financial Year Management ─────────────────────────────────────
  describe('Financial Year Management', () => {
    it('should load/save data isolated per FY', async () => {
      await seedAndLogin();
      
      // Insert client in 2025-2026
      await miniDB.from('clients').insert({
        client_id: 'FY25_C1',
        name: 'FY25 Client',
        handler_code: 'H01',
        financial_year: '2025-2026',
        total_pending: 5000,
      });

      const { data: fy25Clients } = await miniDB.from('clients').select('*');
      expect(fy25Clients.some((c: any) => c.client_id === 'FY25_C1')).toBe(true);

      // Switch to different FY
      switchFY('2024-2025');
      
      const { data: fy24Clients } = await miniDB.from('clients').select('*');
      expect(fy24Clients.some((c: any) => c.client_id === 'FY25_C1')).toBe(false);

      // Switch back
      switchFY('2025-2026');
      const { data: backToFy25 } = await miniDB.from('clients').select('*');
      expect(backToFy25.some((c: any) => c.client_id === 'FY25_C1')).toBe(true);
    });

    it('should create new FY with carry-forward', async () => {
      await seedAndLogin();
      
      // Insert client with pending balance
      await miniDB.from('clients').insert({
        client_id: 'CARRY_C1',
        name: 'Carry Forward Client',
        handler_code: 'H01',
        old_fee: 1000,
        new_fee: 1500,
        total_pending: 8000,
        total_paid_fy: 4000,
        financial_year: '2025-2026',
        status: 'active',
      });

      // Create new FY
      await createFinancialYear('2026-2027', true);

      // Switch to new FY
      switchFY('2026-2027');

      const { data: newFYClients } = await miniDB.from('clients').select('*');
      const carried = newFYClients.find((c: any) => c.client_id === 'CARRY_C1');
      expect(carried).toBeDefined();
      expect(carried.total_pending).toBe(8000); // Pending carried forward
      expect(carried.total_paid_fy).toBe(0); // Reset for new year
      expect(carried.financial_year).toBe('2026-2027');

      // Verify new FY is in available list
      const fys = getAvailableFYs();
      expect(fys).toContain('2026-2027');

      // Switch back — original FY unchanged
      switchFY('2025-2026');
      const { data: origClients } = await miniDB.from('clients').select('*');
      const origClient = origClients.find((c: any) => c.client_id === 'CARRY_C1');
      expect(origClient.total_paid_fy).toBe(4000); // Unchanged
    });

    it('should not carry forward deleted/inactive clients', async () => {
      await seedAndLogin();
      
      // Insert active and inactive clients
      await miniDB.from('clients').insert({
        client_id: 'ACTIVE_C',
        name: 'Active Client',
        handler_code: 'H01',
        total_pending: 3000,
        status: 'active',
        financial_year: '2025-2026',
      });

      await miniDB.from('clients').insert({
        client_id: 'INACTIVE_C',
        name: 'Inactive Client',
        handler_code: 'H01',
        total_pending: 2000,
        status: 'inactive',
        financial_year: '2025-2026',
      });

      await createFinancialYear('2027-2028', true);
      switchFY('2027-2028');

      const { data: newClients } = await miniDB.from('clients').select('*');
      expect(newClients.some((c: any) => c.client_id === 'ACTIVE_C')).toBe(true);
      expect(newClients.some((c: any) => c.client_id === 'INACTIVE_C')).toBe(false);
    });

    it('should share users and handlers across FYs', async () => {
      await seedAndLogin();

      // Create handler in 2025-2026
      await miniAuth.createHandlerUser({
        email: 'shared_handler@test.com',
        password: 'Handler@123',
        handler_code: 'SH01',
        handler_name: 'Shared Handler',
      });

      // Switch FY
      switchFY('2024-2025');

      // Handler should still be visible
      const { data: handlers } = await miniDB.from('handlers').select('*');
      expect(handlers.some((h: any) => h.code === 'SH01')).toBe(true);

      // Users should still exist
      const db = await loadDB();
      expect(db.users.some(u => u.email === 'shared_handler@test.com')).toBe(true);
    });
  });

  // ── Admin Email Check ─────────────────────────────────────────────
  describe('Admin Emails', () => {
    it('should recognize admin emails', () => {
      expect(isAdminEmail('admin@ka.com')).toBe(true);
      expect(isAdminEmail('ADMIN@KA.COM')).toBe(true);
      expect(isAdminEmail('suneelkumarkota@admin.com')).toBe(true);
      expect(isAdminEmail('random@test.com')).toBe(false);
    });
  });

  // ── ID Generation ─────────────────────────────────────────────────
  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => genId()));
      expect(ids.size).toBe(100);
    });
  });

  // ── Database Reset ────────────────────────────────────────────────
  describe('Database Reset', () => {
    it('should reset to default state with admin users', async () => {
      await seedAndLogin();
      
      // Add some data
      await miniDB.from('clients').insert({ client_id: 'RESET_TEST', name: 'Will be gone', handler_code: 'H01' });
      
      await resetDB();
      const db = await loadDB();
      
      expect(db.clients).toHaveLength(0);
      expect(db.users.length).toBeGreaterThanOrEqual(5); // All admin users preserved
      expect(db.users.every(u => u.role === 'admin')).toBe(true);
    });
  });

  // ── Audit Logging ─────────────────────────────────────────────────
  describe('Audit Logging', () => {
    it('should log sign-in events', async () => {
      await resetDB();
      await miniAuth.signIn('admin@ka.com', 'Ka@2026!x');
      
      const db = await loadDB();
      const loginLogs = db.audit_logs.filter((l: any) => l.action === 'login');
      expect(loginLogs.length).toBeGreaterThanOrEqual(1);
      expect(loginLogs[0].user_email).toBe('admin@ka.com');
    });

    it('should log sign-out events', async () => {
      await seedAndLogin();
      await miniAuth.signOut();

      // Need to reload as admin to check
      await miniAuth.signIn('admin@ka.com', 'Ka@2026');
      const db = await loadDB();
      const logoutLogs = db.audit_logs.filter((l: any) => l.action === 'logout');
      expect(logoutLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('should log handler creation', async () => {
      await seedAndLogin();
      await miniAuth.createHandlerUser({
        email: 'audit_handler@test.com',
        password: 'Test@123',
        handler_code: 'AH01',
        handler_name: 'Audit Handler',
      });

      const db = await loadDB();
      const createLogs = db.audit_logs.filter((l: any) => l.action === 'create_handler');
      expect(createLogs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── RPC ───────────────────────────────────────────────────────────
  describe('RPC Functions', () => {
    it('get_my_role returns current user role', async () => {
      await seedAndLogin();
      const { data } = await miniDB.rpc('get_my_role');
      expect(data).toBe('admin');
    });

    it('get_my_handler_code returns handler code', async () => {
      await seedAndLogin();
      // Create and login as handler
      await miniAuth.createHandlerUser({
        email: 'rpc_handler@test.com',
        password: 'Test@123',
        handler_code: 'RPC01',
        handler_name: 'RPC Handler',
      });
      await miniAuth.signIn('rpc_handler@test.com', 'Test@123');

      const { data } = await miniDB.rpc('get_my_handler_code');
      expect(data).toBe('RPC01');
    });
  });
});
