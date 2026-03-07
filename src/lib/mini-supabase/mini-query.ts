import { ERPDatabase, genId, loadDB, UserRole, saveDB } from './mini-db';
import { miniAuth } from './mini-auth';

type TableName = keyof ERPDatabase;
type Filter = { column: string; value: any };

type QueryResult<T = any> = Promise<{ data: T; error: Error | null }>;

const SOFT_DELETE_TABLES = new Set<TableName>(['clients', 'payments', 'invoices']);

function canAccess(role: UserRole, action: 'select' | 'insert' | 'update' | 'delete', table: string, row: Record<string, any>, userId: string) {
  if (role === 'admin' || role === 'manager') return true;
  if (table === 'audit_logs') return action === 'insert' || action === 'select';
  if (table === 'handlers') return action === 'select'; // All authenticated users can view handlers
  if (role === 'viewer') return action === 'select';
  if (table === 'users') return false;
  if (table === 'invoice_items') return true;
  return row.handler_id === userId || action === 'select';
}

class QueryBuilder {
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private operation: 'select' | 'update' | 'delete' = 'select';
  private updatePayload: Record<string, any> | null = null;
  private selectExpr = '*';

  constructor(private readonly table: TableName) {}

  select(expr = '*') {
    this.operation = 'select';
    this.selectExpr = expr;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }

  update(payload: Record<string, any>) {
    this.operation = 'update';
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  async insert(payload: Record<string, any> | Record<string, any>[]): QueryResult<any[]> {
    const user = miniAuth.getCurrentUser();
    if (!user) return { data: [], error: new Error('Not authenticated') };

    const role = user.role;
    const db = await loadDB();
    const rows = Array.isArray(payload) ? payload : [payload];
    const inserted: Record<string, any>[] = [];

    for (const raw of rows) {
      const next = { id: genId(), created_at: new Date().toISOString(), ...raw };
      if (role === 'handler' && ['clients', 'payments', 'invoices', 'income', 'expenses'].includes(this.table)) {
        next.handler_id = user.id;
      }
      if (!canAccess(role, 'insert', this.table, next, user.id)) {
        return { data: [], error: new Error('Permission denied') };
      }
      if (this.table === 'payments' && next.pending === undefined) {
        next.pending = Number(next.due_amount ?? 0) - Number(next.payment ?? 0);
      }
      // Default approval status for payments
      if (this.table === 'payments' && !next.approval_status) {
        next.approval_status = 'pending_approval';
      }
      (db[this.table] as Record<string, any>[]).push(next);
      inserted.push(next);
    }

    await saveDB(db);
    return { data: inserted, error: null };
  }

  async single(): QueryResult<any> {
    const res = await this.execute();
    return { data: Array.isArray(res.data) ? (res.data[0] ?? null) : res.data, error: res.error };
  }

  then<TResult1 = { data: any; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  private async execute(): QueryResult<any[]> {
    const user = miniAuth.getCurrentUser();
    if (!user) return { data: [], error: new Error('Not authenticated') };

    const db = await loadDB();
    const rows = [...(db[this.table] as Record<string, any>[])];
    const role = user.role;

    const filteredByRole = rows.filter((row) => canAccess(role, this.operation, this.table, row, user.id));
    const includeDeleted = this.filters.some((f) => f.column === 'deleted');
    const hideDeletedByDefault = SOFT_DELETE_TABLES.has(this.table) && !includeDeleted;
    const visibleRows = hideDeletedByDefault ? filteredByRole.filter((row) => !row.deleted) : filteredByRole;
    const filteredByEq = visibleRows.filter((row) => this.filters.every((f) => row[f.column] === f.value));

    if (this.operation === 'select') {
      let result = filteredByEq;
      if (this.orderBy) {
        const { column, ascending } = this.orderBy;
        result = [...result].sort((a, b) => {
          const av = a[column];
          const bv = b[column];
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
        });
      }

      if (this.table === 'invoices' && this.selectExpr.includes('invoice_items')) {
        const items = db.invoice_items as Record<string, any>[];
        result = result.map((inv) => ({ ...inv, invoice_items: items.filter((it) => it.invoice_id === inv.id && !it.deleted) }));
      }

      return { data: result, error: null };
    }

    if (this.operation === 'update') {
      if (!this.updatePayload) return { data: [], error: new Error('Missing update payload') };
      const tableRows = db[this.table] as Record<string, any>[];
      const updated: Record<string, any>[] = [];
      for (let i = 0; i < tableRows.length; i++) {
        const row = tableRows[i];
        if (filteredByEq.some((r) => r.id === row.id)) {
          const next = { ...row, ...this.updatePayload, updated_at: new Date().toISOString() };
          if (!canAccess(role, 'update', this.table, next, user.id)) continue;
          tableRows[i] = next;
          updated.push(next);
        }
      }
      await saveDB(db);
      return { data: updated, error: null };
    }

    const tableRows = db[this.table] as Record<string, any>[];
    const targets = tableRows.filter((row) => filteredByEq.some((r) => r.id === row.id));

    if (SOFT_DELETE_TABLES.has(this.table)) {
      for (const row of targets) {
        row.deleted = true;
        row.deleted_at = new Date().toISOString();
      }
      if (this.table === 'invoices' && targets.length > 0) {
        const deletedIds = new Set(targets.map((row) => row.id));
        db.invoice_items = db.invoice_items.map((it) => deletedIds.has(it.invoice_id) ? { ...it, deleted: true, deleted_at: new Date().toISOString() } : it);
      }
      await saveDB(db);
      return { data: targets, error: null };
    }

    const remaining = tableRows.filter((row) => !filteredByEq.some((r) => r.id === row.id));
    db[this.table] = remaining as any;

    await saveDB(db);
    return { data: targets, error: null };
  }
}

export const miniDB = {
  from(table: TableName) {
    return new QueryBuilder(table);
  },

  async rpc(name: string): QueryResult<any> {
    const user = miniAuth.getCurrentUser();
    if (!user && name !== 'assign_role_on_signup') return { data: null, error: null };

    switch (name) {
      case 'assign_role_on_signup':
        return { data: null, error: null };
      case 'get_my_role':
        return { data: user?.role ?? null, error: null };
      case 'get_my_handler_code': {
        const db = await loadDB();
        const handler = db.handlers.find((h) => h.user_id === user?.id);
        return { data: handler?.code ?? null, error: null };
      }
      case 'get_my_handler_id':
        return { data: user?.handler_id ?? null, error: null };
      default:
        return { data: null, error: new Error(`Unknown RPC: ${name}`) };
    }
  },
};
