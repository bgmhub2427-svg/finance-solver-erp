import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { Organization, OrgConfig } from '@/lib/org-types';
import { ALL_MODULES } from '@/lib/org-types';

const ACTIVE_ORG_KEY = 'erp_active_org_id';
const ORGS_KEY = 'erp_organizations';

function loadOrgs(): Organization[] {
  try {
    const raw = localStorage.getItem(ORGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveOrgs(orgs: Organization[]) {
  localStorage.setItem(ORGS_KEY, JSON.stringify(orgs));
}

export function getActiveOrgId(): string {
  return localStorage.getItem(ACTIVE_ORG_KEY) || 'default';
}

export function setActiveOrgId(id: string) {
  localStorage.setItem(ACTIVE_ORG_KEY, id);
}

interface OrgCtx {
  org: Organization | null;
  orgs: Organization[];
  activeOrgId: string;
  setActiveOrg: (id: string) => void;
  createOrg: (org: Organization) => void;
  updateOrgConfig: (config: Partial<OrgConfig>) => void;
  enabledModules: string[];
  isOrgSetupDone: boolean;
}

const OrgContext = createContext<OrgCtx>({
  org: null,
  orgs: [],
  activeOrgId: 'default',
  setActiveOrg: () => {},
  createOrg: () => {},
  updateOrgConfig: () => {},
  enabledModules: ALL_MODULES.map(m => m.id),
  isOrgSetupDone: false,
});

export function OrgProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<Organization[]>(loadOrgs);
  const [activeOrgId, setOrgId] = useState(getActiveOrgId);

  const org = orgs.find(o => o.id === activeOrgId) || null;
  const enabledModules = org?.config?.enabled_modules || ALL_MODULES.map(m => m.id);
  const isOrgSetupDone = orgs.length > 0 && !!org;

  const setActiveOrg = useCallback((id: string) => {
    setActiveOrgId(id);
    setOrgId(id);
  }, []);

  const createOrg = useCallback((newOrg: Organization) => {
    const updated = [...orgs, newOrg];
    saveOrgs(updated);
    setOrgs(updated);
    setActiveOrg(newOrg.id);
  }, [orgs, setActiveOrg]);

  const updateOrgConfig = useCallback((configUpdate: Partial<OrgConfig>) => {
    if (!org) return;
    const updated = orgs.map(o =>
      o.id === activeOrgId
        ? { ...o, config: { ...o.config, ...configUpdate } }
        : o
    );
    saveOrgs(updated);
    setOrgs(updated);
  }, [org, orgs, activeOrgId]);

  return (
    <OrgContext.Provider value={{ org, orgs, activeOrgId, setActiveOrg, createOrg, updateOrgConfig, enabledModules, isOrgSetupDone }}>
      {children}
    </OrgContext.Provider>
  );
}

export const useOrg = () => useContext(OrgContext);
