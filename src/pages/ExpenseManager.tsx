import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { miniDB } from '@/lib/mini-supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet, Plus, Trash2, Download, Search, X, Filter,
  Building2, Zap, Globe, Briefcase, Package, Coffee, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const EXPENSE_CATEGORIES = [
  { value: 'employee_salaries', label: 'Employee Salaries', icon: Users },
  { value: 'electricity', label: 'Electricity Bill', icon: Zap },
  { value: 'office_rent', label: 'Office Rent', icon: Building2 },
  { value: 'internet', label: 'Internet Bill', icon: Globe },
  { value: 'software', label: 'Software Subscriptions', icon: Briefcase },
  { value: 'office_supplies', label: 'Office Supplies', icon: Package },
  { value: 'miscellaneous', label: 'Miscellaneous', icon: Coffee },
];

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'];

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  remarks: string;
  created_at: string;
  created_by: string;
}

interface Salary {
  id: string;
  employee_name: string;
  role: string;
  salary_amount: number;
  month: string;
  payment_status: 'paid' | 'pending' | 'partial';
  paid_amount: number;
  payment_date: string;
  remarks: string;
  created_at: string;
}

export default function ExpenseManager() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'expenses' | 'salaries'>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: 'miscellaneous',
    description: '',
    amount: '',
    payment_method: 'Cash',
    remarks: '',
  });

  const [salaryForm, setSalaryForm] = useState({
    employee_name: '',
    role: 'handler',
    salary_amount: '',
    month: new Date().toISOString().slice(0, 7),
    payment_status: 'pending' as 'paid' | 'pending' | 'partial',
    paid_amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    remarks: '',
  });

  // Load data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: expData } = await miniDB.from('expenses').select('*').order('date', { ascending: false });
      if (expData) setExpenses(expData as Expense[]);

      const { data: salData } = await miniDB.from('salaries').select('*').order('month', { ascending: false });
      if (salData) setSalaries(salData as Salary[]);
    } catch (err) {
      console.error('Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const addExpense = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    await miniDB.from('expenses').insert({
      date: form.date,
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      remarks: form.remarks,
      created_by: user?.email || '',
      created_at: new Date().toISOString(),
    });
    toast({ title: 'Expense added' });
    setShowForm(false);
    setForm({ date: new Date().toISOString().slice(0, 10), category: 'miscellaneous', description: '', amount: '', payment_method: 'Cash', remarks: '' });
    fetchData();
  };

  const addSalary = async () => {
    if (!salaryForm.employee_name || !salaryForm.salary_amount) {
      toast({ title: 'Fill all required fields', variant: 'destructive' });
      return;
    }
    const paidAmt = salaryForm.payment_status === 'paid' ? Number(salaryForm.salary_amount) : Number(salaryForm.paid_amount || 0);

    await miniDB.from('salaries').insert({
      employee_name: salaryForm.employee_name,
      role: salaryForm.role,
      salary_amount: Number(salaryForm.salary_amount),
      month: salaryForm.month,
      payment_status: salaryForm.payment_status,
      paid_amount: paidAmt,
      payment_date: salaryForm.payment_date,
      remarks: salaryForm.remarks,
      created_at: new Date().toISOString(),
    });

    // Auto-add to expenses
    if (paidAmt > 0) {
      await miniDB.from('expenses').insert({
        date: salaryForm.payment_date,
        category: 'employee_salaries',
        description: `Salary — ${salaryForm.employee_name} (${salaryForm.month})`,
        amount: paidAmt,
        payment_method: 'Bank Transfer',
        remarks: `Auto-generated from salary record`,
        created_by: user?.email || '',
        created_at: new Date().toISOString(),
      });
    }

    toast({ title: 'Salary record added' });
    setShowSalaryForm(false);
    setSalaryForm({ employee_name: '', role: 'handler', salary_amount: '', month: new Date().toISOString().slice(0, 7), payment_status: 'pending', paid_amount: '', payment_date: new Date().toISOString().slice(0, 10), remarks: '' });
    fetchData();
  };

  const deleteExpense = async (id: string) => {
    await miniDB.from('expenses').delete().eq('id', id);
    toast({ title: 'Expense deleted' });
    fetchData();
  };

  // Filtered expenses
  const filtered = useMemo(() => {
    let rows = [...expenses];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.description.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
    }
    if (catFilter !== 'ALL') rows = rows.filter(r => r.category === catFilter);
    if (monthFilter !== 'ALL') rows = rows.filter(r => r.date.slice(0, 7) === monthFilter);
    return rows;
  }, [expenses, search, catFilter, monthFilter]);

  // Summary
  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyTotal = expenses.filter(e => e.date.slice(0, 7) === thisMonth).reduce((s, e) => s + e.amount, 0);
  const salaryTotal = expenses.filter(e => e.category === 'employee_salaries').reduce((s, e) => s + e.amount, 0);
  const uniqueMonths = [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort().reverse();

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(e => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const exportToExcel = () => {
    const headers = ['#', 'Date', 'Category', 'Description', 'Amount', 'Payment Method', 'Remarks'];
    const rows = filtered.map((e, i) => [
      i + 1, e.date,
      EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category,
      e.description, e.amount, e.payment_method, e.remarks,
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

    if (salaries.length > 0) {
      const salHeaders = ['Employee', 'Role', 'Month', 'Salary', 'Paid', 'Status', 'Remarks'];
      const salRows = salaries.map(s => [s.employee_name, s.role, s.month, s.salary_amount, s.paid_amount, s.payment_status, s.remarks]);
      const wsSal = XLSX.utils.aoa_to_sheet([salHeaders, ...salRows]);
      wsSal['!cols'] = salHeaders.map(() => ({ wch: 16 }));
      XLSX.utils.book_append_sheet(wb, wsSal, 'Salaries');
    }

    XLSX.writeFile(wb, `Expenses-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Excel exported' });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Admin access required for Expense Management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="erp-page-title flex items-center gap-2"><Wallet className="w-5 h-5" /> Expense Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track office expenses and salaries</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="outline" size="sm" className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('expenses')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'expenses' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          Expenses
        </button>
        <button onClick={() => setTab('salaries')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'salaries' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          Salaries
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="erp-kpi-card flex items-start gap-3">
          <div className="kpi-icon-box bg-destructive/10"><Wallet className="w-4 h-4 text-destructive" /></div>
          <div><p className="text-[11px] text-muted-foreground">Total Expenses</p><p className="kpi-value erp-mono">{formatCurrency(totalExpenses)}</p></div>
        </div>
        <div className="erp-kpi-card flex items-start gap-3">
          <div className="kpi-icon-box bg-warning/10"><Wallet className="w-4 h-4 text-warning" /></div>
          <div><p className="text-[11px] text-muted-foreground">This Month</p><p className="kpi-value erp-mono">{formatCurrency(monthlyTotal)}</p></div>
        </div>
        <div className="erp-kpi-card flex items-start gap-3">
          <div className="kpi-icon-box bg-info/10"><Users className="w-4 h-4 text-info" /></div>
          <div><p className="text-[11px] text-muted-foreground">Salary Expenses</p><p className="kpi-value erp-mono">{formatCurrency(salaryTotal)}</p></div>
        </div>
        <div className="erp-kpi-card flex items-start gap-3">
          <div className="kpi-icon-box bg-success/10"><Package className="w-4 h-4 text-success" /></div>
          <div><p className="text-[11px] text-muted-foreground">Categories Used</p><p className="kpi-value erp-mono">{categoryBreakdown.length}</p></div>
        </div>
      </div>

      {tab === 'expenses' && (
        <>
          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="erp-kpi-card">
              <h3 className="text-sm font-semibold mb-3">Category Breakdown</h3>
              <div className="space-y-2">
                {categoryBreakdown.map(([cat, amount]) => {
                  const catDef = EXPENSE_CATEGORIES.find(c => c.value === cat);
                  const pct = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : '0';
                  return (
                    <div key={cat} className="flex items-center gap-3 text-xs">
                      <span className="w-32 truncate text-muted-foreground">{catDef?.label || cat}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="erp-mono w-20 text-right font-medium">{formatCurrency(amount)}</span>
                      <span className="erp-mono w-12 text-right text-muted-foreground">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters + Add */}
          <div className="erp-kpi-card p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..."
                  className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                <option value="ALL">All Categories</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                <option value="ALL">All Months</option>
                {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Expense
              </Button>
            </div>
          </div>

          {/* Add Expense Form */}
          {showForm && (
            <div className="erp-kpi-card border-2 border-primary/20 space-y-3">
              <h3 className="text-sm font-semibold">New Expense</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                    {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Amount (₹)</label>
                  <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="0" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Payment Method</label>
                  <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Description</label>
                  <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="Brief description" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Remarks</label>
                  <input value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="Optional" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button size="sm" onClick={addExpense}>Save Expense</Button>
              </div>
            </div>
          )}

          {/* Expense Table */}
          <div className="erp-kpi-card p-0 overflow-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                  <th>Payment</th>
                  <th>Remarks</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">No expenses recorded yet.</td></tr>
                )}
                {filtered.map((e, i) => (
                  <tr key={e.id}>
                    <td className="erp-mono text-xs">{i + 1}</td>
                    <td className="erp-mono text-xs">{e.date}</td>
                    <td className="text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                        {EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                      </span>
                    </td>
                    <td className="text-xs max-w-[200px] truncate">{e.description}</td>
                    <td className="erp-mono text-xs text-right font-bold text-destructive">{formatCurrency(e.amount)}</td>
                    <td className="text-xs">{e.payment_method}</td>
                    <td className="text-xs text-muted-foreground max-w-[150px] truncate">{e.remarks}</td>
                    <td>
                      <button onClick={() => deleteExpense(e.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'salaries' && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setShowSalaryForm(!showSalaryForm)} size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Salary Record
            </Button>
          </div>

          {showSalaryForm && (
            <div className="erp-kpi-card border-2 border-primary/20 space-y-3">
              <h3 className="text-sm font-semibold">New Salary Record</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Employee Name *</label>
                  <input value={salaryForm.employee_name} onChange={e => setSalaryForm({ ...salaryForm, employee_name: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="Full name" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Role</label>
                  <select value={salaryForm.role} onChange={e => setSalaryForm({ ...salaryForm, role: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                    <option value="admin">Admin</option>
                    <option value="handler">Handler</option>
                    <option value="fee_collector">Fee Collector</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Salary Amount (₹) *</label>
                  <input type="number" value={salaryForm.salary_amount} onChange={e => setSalaryForm({ ...salaryForm, salary_amount: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="0" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Month</label>
                  <input type="month" value={salaryForm.month} onChange={e => setSalaryForm({ ...salaryForm, month: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Payment Status</label>
                  <select value={salaryForm.payment_status} onChange={e => setSalaryForm({ ...salaryForm, payment_status: e.target.value as any })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
                {salaryForm.payment_status === 'partial' && (
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium">Paid Amount (₹)</label>
                    <input type="number" value={salaryForm.paid_amount} onChange={e => setSalaryForm({ ...salaryForm, paid_amount: e.target.value })}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Payment Date</label>
                  <input type="date" value={salaryForm.payment_date} onChange={e => setSalaryForm({ ...salaryForm, payment_date: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Remarks</label>
                  <input value={salaryForm.remarks} onChange={e => setSalaryForm({ ...salaryForm, remarks: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="Optional" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowSalaryForm(false)}>Cancel</Button>
                <Button size="sm" onClick={addSalary}>Save Salary</Button>
              </div>
            </div>
          )}

          {/* Salary Table */}
          <div className="erp-kpi-card p-0 overflow-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Month</th>
                  <th className="text-right">Salary</th>
                  <th className="text-right">Paid</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {salaries.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">No salary records yet.</td></tr>
                )}
                {salaries.map((s, i) => (
                  <tr key={s.id}>
                    <td className="erp-mono text-xs">{i + 1}</td>
                    <td className="text-xs font-medium">{s.employee_name}</td>
                    <td className="text-xs capitalize">{s.role}</td>
                    <td className="erp-mono text-xs">{s.month}</td>
                    <td className="erp-mono text-xs text-right">{formatCurrency(s.salary_amount)}</td>
                    <td className="erp-mono text-xs text-right font-medium">{formatCurrency(s.paid_amount)}</td>
                    <td>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        s.payment_status === 'paid' ? 'bg-success/15 text-success' :
                        s.payment_status === 'partial' ? 'bg-warning/15 text-warning' :
                        'bg-destructive/15 text-destructive'
                      }`}>
                        {s.payment_status.charAt(0).toUpperCase() + s.payment_status.slice(1)}
                      </span>
                    </td>
                    <td className="text-xs text-muted-foreground">{s.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
