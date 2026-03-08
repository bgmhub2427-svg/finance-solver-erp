import { useState } from 'react';
import { Building2, ChevronRight, ChevronLeft, Check, Sparkles, Users, Minus, Plus, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOrg } from '@/hooks/useOrg';
import { useAuth } from '@/hooks/useAuth';
import { miniAuth } from '@/lib/mini-supabase';
import { mainAuth } from '@/lib/main-auth';
import { SETUP_STEPS, deriveModules, defaultRoleLimits, ROLE_LABELS, validatePassword, type OrgConfig, type RoleLimits } from '@/lib/org-types';
import { playClick, playSuccess } from '@/lib/sound-engine';
import { useToast } from '@/hooks/use-toast';
import kaLogo from '@/assets/kota-associates-logo.png';

export default function OrgSetup() {
  const { createOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPassword, setOrgPassword] = useState('');
  const [showOrgPw, setShowOrgPw] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [roleLimits, setRoleLimits] = useState<RoleLimits>(defaultRoleLimits('6-20'));

  // Steps: org name + setup questions + role limits
  const totalSteps = SETUP_STEPS.length + 2;
  const isNameStep = step === 0;
  const isRoleStep = step === totalSteps - 1;
  const setupStepIdx = step - 1;
  const setupStep = !isNameStep && !isRoleStep && setupStepIdx >= 0 && setupStepIdx < SETUP_STEPS.length
    ? SETUP_STEPS[setupStepIdx]
    : null;
  const isMulti = (setupStep as any)?.multi === true;

  const handleSelect = (value: string) => {
    if (!setupStep) return;
    playClick();
    if (isMulti) {
      const current = (answers[setupStep.key] as string[]) || [];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      setAnswers({ ...answers, [setupStep.key]: updated });
    } else {
      setAnswers({ ...answers, [setupStep.key]: value });
      // Auto-update role limits when team size changes
      if (setupStep.key === 'team_size') {
        setRoleLimits(defaultRoleLimits(value));
      }
    }
  };

  const adjustRole = (role: keyof RoleLimits, delta: number) => {
    playClick();
    setRoleLimits(prev => ({
      ...prev,
      [role]: Math.max(0, Math.min(99, prev[role] + delta)),
    }));
  };

  const canProceed = () => {
    if (isNameStep) return orgName.trim().length >= 2;
    if (isRoleStep) return true;
    if (!setupStep) return false;
    const val = answers[setupStep.key];
    if (isMulti) return Array.isArray(val) && val.length > 0;
    return !!val;
  };

  const handleFinish = () => {
    playSuccess();
    const config: OrgConfig = {
      org_type: (answers.org_type as string) || 'other',
      team_size: (answers.team_size as string) || '1-5',
      billing_model: (answers.billing_model as string) || 'monthly',
      services: (answers.services as string[]) || [],
      roles: ['admin', 'manager', 'handler', 'viewer', 'fee_collector'],
      payment_structure: (answers.payment_structure as string) || 'variable',
      enabled_modules: deriveModules({
        org_type: answers.org_type as string,
        team_size: answers.team_size as string,
        billing_model: answers.billing_model as string,
        services: answers.services as string[],
        payment_structure: answers.payment_structure as string,
      } as Partial<OrgConfig>),
      role_limits: roleLimits,
    };

    const slug = orgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    const orgId = crypto.randomUUID?.() || `org-${Date.now()}`;
    
    createOrg({
      id: orgId,
      name: orgName.trim(),
      slug,
      owner_id: user?.id || '',
      owner_email: user?.email || '',
      created_at: new Date().toISOString(),
      config,
    });

    if (user?.id) {
      miniAuth.updateUserOrgId(user.id, orgId);
    }
  };

  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center auth-bg relative overflow-hidden">
      <div className="auth-orb w-72 h-72 bg-primary/20 top-[-10%] left-[-5%]" style={{ animationDelay: '0s' }} />
      <div className="auth-orb w-96 h-96 bg-accent/15 bottom-[-15%] right-[-10%]" style={{ animationDelay: '3s' }} />
      <div className="absolute inset-0 dot-grid opacity-40" />

      <div className="relative z-10 w-full max-w-lg px-4">
        <div className="auth-card glass-strong rounded-2xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <img src={kaLogo} alt="Kota Associates" className="w-14 h-14 mx-auto rounded-2xl shadow-lg object-contain" />
            <h1 className="text-xl font-bold gradient-text">Set Up Your Organization</h1>
            <p className="text-xs text-muted-foreground">
              Step {step + 1} of {totalSteps} — We&apos;ll configure your ERP based on your answers
            </p>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step content */}
          {isNameStep ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Organization Name</label>
                <Input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. Kota Associates, XYZ Finance"
                  className="mt-2 h-12 rounded-xl text-base"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  This will be your company&apos;s display name in the ERP system.
                </p>
              </div>
            </div>
          ) : isRoleStep ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium text-foreground">How many of each role do you need?</p>
              </div>
              <p className="text-[11px] text-muted-foreground">You can change these limits anytime in Settings.</p>
              <div className="grid gap-2.5">
                {(Object.keys(roleLimits) as (keyof RoleLimits)[]).map(role => (
                  <div
                    key={role}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-muted/30"
                  >
                    <div>
                      <p className="text-sm font-medium">{ROLE_LABELS[role] || role}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => adjustRole(role, -1)}
                        className="w-7 h-7 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="erp-mono text-base font-bold w-6 text-center">{roleLimits[role]}</span>
                      <button
                        onClick={() => adjustRole(role, 1)}
                        className="w-7 h-7 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : setupStep ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">{setupStep.label}</p>
              <div className="grid gap-2">
                {setupStep.options.map(opt => {
                  const selected = isMulti
                    ? ((answers[setupStep.key] as string[]) || []).includes(opt.value)
                    : answers[setupStep.key] === opt.value;

                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border/60 hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        selected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                      }`}>
                        {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        {opt.desc && <p className="text-[11px] text-muted-foreground">{opt.desc}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStep(Math.max(0, step - 1)); playClick(); }}
              disabled={step === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>

            {step < totalSteps - 1 ? (
              <Button
                size="sm"
                onClick={() => { setStep(step + 1); playClick(); }}
                disabled={!canProceed()}
                className="gap-1 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleFinish}
                disabled={!canProceed()}
                className="gap-1.5 bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                <Sparkles className="w-4 h-4" /> Launch ERP
              </Button>
            )}
          </div>

          {/* Footer branding */}
          <div className="text-center pt-2 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground">Finance Solver — F.S.001 • Created by Kota Associates</p>
          </div>
        </div>
      </div>
    </div>
  );
}
