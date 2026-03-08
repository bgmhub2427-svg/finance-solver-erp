export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  owner_email: string;
  created_at: string;
  config: OrgConfig;
}

export interface OrgConfig {
  org_type: string;
  team_size: string;
  billing_model: string;
  services: string[];
  roles: string[];
  payment_structure: string;
  enabled_modules: string[];
  role_limits: RoleLimits;
}

export interface RoleLimits {
  admin: number;
  manager: number;
  handler: number;
  viewer: number;
  fee_collector: number;
}

export interface ModuleDef {
  id: string;
  label: string;
  icon: string;
  path: string;
  core?: boolean;
  adminOnly?: boolean;
  nonViewer?: boolean;
  adminOrViewer?: boolean;
}

export const CORE_MODULES: ModuleDef[] = [
  { id: 'approvals', label: 'Approvals', icon: 'CheckSquare', path: '/approvals', adminOnly: true },
  { id: 'upload-sync', label: 'Upload Sync', icon: 'Receipt', path: '/upload-sync', nonViewer: true, core: true },
  { id: 'reports', label: 'Reports', icon: 'TrendingUp', path: '/reports', adminOrViewer: true, core: true },
  { id: 'advanced-reports', label: 'Advanced Analytics', icon: 'TrendingUp', path: '/advanced-reports', adminOrViewer: true, core: true },
  { id: 'risk-detection', label: 'Risk Detection', icon: 'ShieldAlert', path: '/risk-detection', adminOnly: true, core: true },
  { id: 'ai-planner', label: 'AI Collection Planner', icon: 'Brain', path: '/ai-planner', core: true },
  { id: 'excel-master-sync', label: 'Excel Master Sync', icon: 'Download', path: '/excel-master-sync', adminOnly: true, core: true },
  { id: 'month-lock', label: 'Month Lock', icon: 'Lock', path: '/month-lock', adminOnly: true, core: true },
  { id: 'audit-log', label: 'Audit Log', icon: 'ScrollText', path: '/audit-log', adminOnly: true, core: true },
  { id: 'settings', label: 'Settings', icon: 'Settings', path: '/settings', adminOnly: true, core: true },
];

export const OPTIONAL_MODULES: ModuleDef[] = [
  { id: 'control-panel', label: 'Control Panel', icon: 'LayoutDashboard', path: '/control-panel' },
  { id: 'collection-dashboard', label: 'Collection Dashboard', icon: 'Calendar', path: '/collection-dashboard' },
  { id: 'handler-master', label: 'Staff / Handlers', icon: 'UserCog', path: '/handler-master', adminOnly: true },
  { id: 'client-master', label: 'Client Master', icon: 'Users', path: '/client-master', nonViewer: true },
  { id: 'master-database', label: 'Master Database', icon: 'Database', path: '/master-database', adminOrViewer: true },
  { id: 'payments', label: 'Payment Tracking', icon: 'IndianRupee', path: '/payments' },
  { id: 'payment-pending', label: 'Pending Checklist', icon: 'ClipboardCheck', path: '/payment-pending' },
  { id: 'invoices', label: 'Invoice Manager', icon: 'FileText', path: '/invoices', nonViewer: true },
  { id: 'invoice-database', label: 'Invoice Database', icon: 'FileSpreadsheet', path: '/invoice-database', adminOrViewer: true },
];

export const ALL_MODULES = [...OPTIONAL_MODULES, ...CORE_MODULES];

export function deriveModules(config: Partial<OrgConfig>): string[] {
  const modules: string[] = CORE_MODULES.map(m => m.id);
  modules.push('control-panel');

  const services = config.services || [];
  const teamSize = config.team_size || '1-5';
  const billing = config.billing_model || 'monthly';

  if (services.some(s => ['collections', 'accounting', 'tax_filing'].includes(s))) {
    modules.push('collection-dashboard', 'payments', 'payment-pending');
  }
  if (services.some(s => ['consulting', 'tax_filing', 'audit', 'accounting'].includes(s))) {
    modules.push('client-master', 'master-database');
  }
  if (services.some(s => ['audit', 'consulting'].includes(s)) || billing === 'project_based') {
    modules.push('invoices', 'invoice-database');
  }
  if (teamSize !== '1-5') {
    modules.push('handler-master');
  }

  return [...new Set(modules)];
}

export function defaultRoleLimits(teamSize: string): RoleLimits {
  switch (teamSize) {
    case '1-5': return { admin: 1, manager: 1, handler: 3, viewer: 2, fee_collector: 1 };
    case '6-20': return { admin: 2, manager: 3, handler: 10, viewer: 5, fee_collector: 3 };
    case '21-50': return { admin: 3, manager: 5, handler: 30, viewer: 10, fee_collector: 5 };
    case '50+': return { admin: 5, manager: 10, handler: 50, viewer: 20, fee_collector: 10 };
    default: return { admin: 2, manager: 3, handler: 10, viewer: 5, fee_collector: 3 };
  }
}

export function defaultOrgConfig(): OrgConfig {
  return {
    org_type: 'ca_firm',
    team_size: '6-20',
    billing_model: 'monthly',
    services: ['tax_filing', 'accounting', 'collections'],
    roles: ['admin', 'manager', 'handler', 'viewer', 'fee_collector'],
    payment_structure: 'variable',
    enabled_modules: ALL_MODULES.map(m => m.id),
    role_limits: defaultRoleLimits('6-20'),
  };
}

export const SETUP_STEPS = [
  {
    key: 'org_type',
    label: 'What type of organization are you?',
    options: [
      { value: 'ca_firm', label: 'CA / Accounting Firm', desc: 'Tax, audit, and accounting services' },
      { value: 'finance_company', label: 'Finance Company', desc: 'Lending, collections, financial services' },
      { value: 'collection_agency', label: 'Collection Agency', desc: 'Debt recovery and collection' },
      { value: 'consulting', label: 'Consulting Firm', desc: 'Business advisory and consulting' },
      { value: 'other', label: 'Other', desc: 'Custom business type' },
    ],
  },
  {
    key: 'team_size',
    label: 'How large is your team?',
    options: [
      { value: '1-5', label: '1–5 members', desc: 'Small team, minimal hierarchy' },
      { value: '6-20', label: '6–20 members', desc: 'Growing team with defined roles' },
      { value: '21-50', label: '21–50 members', desc: 'Large team with departments' },
      { value: '50+', label: '50+ members', desc: 'Enterprise-scale operations' },
    ],
  },
  {
    key: 'billing_model',
    label: 'How do you bill your clients?',
    options: [
      { value: 'monthly', label: 'Monthly Retainer', desc: 'Fixed monthly fees' },
      { value: 'project_based', label: 'Project-Based', desc: 'Per-project billing' },
      { value: 'commission', label: 'Commission', desc: 'Percentage-based fees' },
      { value: 'hybrid', label: 'Hybrid', desc: 'Mix of billing models' },
    ],
  },
  {
    key: 'services',
    label: 'What services do you offer?',
    multi: true,
    options: [
      { value: 'tax_filing', label: 'Tax Filing', desc: '' },
      { value: 'accounting', label: 'Accounting', desc: '' },
      { value: 'audit', label: 'Audit', desc: '' },
      { value: 'consulting', label: 'Consulting', desc: '' },
      { value: 'collections', label: 'Collections', desc: '' },
      { value: 'payroll', label: 'Payroll', desc: '' },
    ],
  },
  {
    key: 'payment_structure',
    label: 'How are your fees structured?',
    options: [
      { value: 'fixed', label: 'Fixed Fee', desc: 'Same fee for all clients' },
      { value: 'variable', label: 'Variable', desc: 'Different fees per client' },
      { value: 'milestone', label: 'Milestone-Based', desc: 'Fees tied to deliverables' },
    ],
  },
];

// Strong password validation
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('At least one special character');
  return { valid: errors.length === 0, errors };
}
