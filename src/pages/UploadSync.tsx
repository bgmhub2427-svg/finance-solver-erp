import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useERP } from '@/lib/erp-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Shield,
} from 'lucide-react';
import {
  generatePaymentTemplate,
  parseExcelToJSON,
  processPaymentJSON,
  type ParsedUploadPayload,
  type ProcessResult,
} from '@/lib/excel-engine';

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

type Step = 'generate' | 'convert' | 'import';

export default function UploadSync() {
  const { user, isAdmin } = useAuth();
  const { clients, handlers, currentFY, refreshData } = useERP();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('generate');

  // Step 2 — Excel → JSON
  const [parsedPayload, setParsedPayload] = useState<ParsedUploadPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 3 — Import result
  const [importResult, setImportResult] = useState<ProcessResult | null>(null);
  const [importing, setImporting] = useState(false);

  const fyClients = useMemo(
    () => clients.filter(c => c.financialYear === currentFY),
    [clients, currentFY],
  );

  // ─── Step 1: Generate Template ─────────────────────────────────────────
  const handleGenerateTemplate = () => {
    if (fyClients.length === 0) {
      toast({ title: 'No clients', description: 'Add clients before generating a template.', variant: 'destructive' });
      return;
    }
    generatePaymentTemplate({
      clients: fyClients,
      handlers,
      financialYear: currentFY,
      generatedBy: user?.email || 'system',
    });
    toast({ title: 'Template downloaded', description: `${fyClients.length} clients included.` });
  };

  // ─── Step 2: Parse Excel ───────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    setParseError(null);
    setParsedPayload(null);
    setImportResult(null);

    try {
      const payload = await parseExcelToJSON(file, fyClients);
      setParsedPayload(payload);

      if (payload.validation.errors.length > 0) {
        toast({
          title: 'Validation errors found',
          description: `${payload.validation.errors.length} errors — fix before importing.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Excel parsed successfully',
          description: `${payload.validation.entries_with_payment} payments totaling ${formatCurrency(payload.validation.total_payment_amount)}`,
        });
        setStep('import');
      }
    } catch (err: any) {
      setParseError(err.message);
      toast({ title: 'Parse failed', description: err.message, variant: 'destructive' });
    }
  };

  // ─── Step 3: Import to ERP ─────────────────────────────────────────────
  const handleImport = async () => {
    if (!parsedPayload || !user?.email) return;
    setImporting(true);
    try {
      const result = await processPaymentJSON(parsedPayload, user.email);
      setImportResult(result);
      await refreshData();

      if (result.success) {
        toast({
          title: 'Import successful',
          description: `${result.processed} payments (${formatCurrency(result.totalAmountProcessed)}) recorded.`,
        });
      } else {
        toast({
          title: 'Import completed with issues',
          description: `${result.processed} processed, ${result.skipped} skipped, ${result.errors.length} errors.`,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setParsedPayload(null);
    setParseError(null);
    setImportResult(null);
    setStep('generate');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="erp-page-title flex items-center gap-2">
          <Upload className="w-5 h-5" /> Excel → JSON → ERP Upload
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Secure, zero-training data ingestion. Generate template → Fill payments → Upload.
        </p>
      </div>

      {/* ─── Step Indicators ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs">
        <StepBadge label="1. Generate Template" active={step === 'generate'} done={step !== 'generate'} />
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
        <StepBadge label="2. Upload Excel" active={step === 'convert'} done={step === 'import'} />
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
        <StepBadge label="3. Validate & Import" active={step === 'import'} done={!!importResult?.success} />
      </div>

      {/* ─── Step 1: Generate ──────────────────────────────────────────── */}
      <div className="erp-kpi-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Step 1 — Generate Payment Template
          </h3>
          {isAdmin && (
            <Button size="sm" onClick={handleGenerateTemplate} className="gap-1">
              <Download className="w-3.5 h-3.5" /> Download Template
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Pre-fills <strong>{fyClients.length} clients</strong> for FY {currentFY}</p>
          <p>• Columns A–G are <strong>locked</strong> (Client ID, Name, Handler, Fees)</p>
          <p>• Employee fills only: <strong>Payment Received, Paid Term, Remarks, Date</strong></p>
          <p>• Includes metadata sheet for integrity verification</p>
        </div>
        {!isAdmin && (
          <p className="text-xs text-amber-600">Only admins can generate templates. Ask your admin for the file.</p>
        )}
        {step === 'generate' && (
          <Button size="sm" variant="outline" onClick={() => setStep('convert')} className="gap-1">
            Next: Upload Excel <ArrowRight className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* ─── Step 2: Upload & Parse ────────────────────────────────────── */}
      <div className={`erp-kpi-card space-y-3 ${step === 'generate' ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Upload className="w-4 h-4" /> Step 2 — Upload Filled Excel
        </h3>
        <Input
          type="file"
          accept=".xlsx,.xls"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
          }}
        />

        {parseError && (
          <div className="text-xs bg-destructive/10 text-destructive rounded p-2 flex items-start gap-2">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {parsedPayload && (
          <div className="space-y-2">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="bg-muted rounded p-2 text-center">
                <p className="text-muted-foreground">Total Rows</p>
                <p className="font-bold erp-mono">{parsedPayload.validation.total_entries}</p>
              </div>
              <div className="bg-muted rounded p-2 text-center">
                <p className="text-muted-foreground">With Payment</p>
                <p className="font-bold erp-mono">{parsedPayload.validation.entries_with_payment}</p>
              </div>
              <div className="bg-muted rounded p-2 text-center">
                <p className="text-muted-foreground">Total Amount</p>
                <p className="font-bold erp-mono">{formatCurrency(parsedPayload.validation.total_payment_amount)}</p>
              </div>
              <div className="bg-muted rounded p-2 text-center">
                <p className="text-muted-foreground">File Hash</p>
                <p className="font-bold erp-mono truncate text-[10px]">{parsedPayload.metadata.file_hash.slice(0, 16)}…</p>
              </div>
            </div>

            {/* Errors */}
            {parsedPayload.validation.errors.length > 0 && (
              <div className="bg-destructive/10 rounded p-2 space-y-1">
                <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> {parsedPayload.validation.errors.length} Errors — Must fix before import
                </p>
                {parsedPayload.validation.errors.map((e, i) => (
                  <p key={i} className="text-[11px] text-destructive/80">• {e}</p>
                ))}
              </div>
            )}

            {/* Warnings */}
            {parsedPayload.validation.warnings.length > 0 && (
              <div className="bg-amber-500/10 rounded p-2 space-y-1">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {parsedPayload.validation.warnings.length} Warnings
                </p>
                {parsedPayload.validation.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-600">• {w}</p>
                ))}
              </div>
            )}

            {/* Entries preview */}
            {parsedPayload.entries.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">Preview entries ({parsedPayload.entries.length})</summary>
                <div className="mt-1 max-h-48 overflow-y-auto border rounded">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-1 text-left">Client ID</th>
                        <th className="p-1 text-left">Name</th>
                        <th className="p-1 text-right">Payment</th>
                        <th className="p-1 text-left">From</th>
                        <th className="p-1 text-left">To</th>
                        <th className="p-1 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedPayload.entries.map((e, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-1 erp-mono">{e.client_id}</td>
                          <td className="p-1">{e.client_name}</td>
                          <td className="p-1 text-right erp-mono">{formatCurrency(e.payment_received)}</td>
                          <td className="p-1">{e.paid_term_from}</td>
                          <td className="p-1">{e.paid_term_to}</td>
                          <td className="p-1 erp-mono">{e.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* ─── Step 3: Import ────────────────────────────────────────────── */}
      <div className={`erp-kpi-card space-y-3 ${step !== 'import' ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4" /> Step 3 — Validate & Import to ERP
        </h3>

        {!importResult ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              This will create <strong>{parsedPayload?.validation.entries_with_payment || 0}</strong> payment records
              totaling <strong>{formatCurrency(parsedPayload?.validation.total_payment_amount || 0)}</strong> and
              automatically update client dues.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleImport}
                disabled={importing || !parsedPayload || parsedPayload.validation.errors.length > 0}
                className="gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {importing ? 'Processing...' : 'Confirm & Import'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleReset}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className={`rounded p-3 text-xs ${importResult.success ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
              <p className={`font-semibold flex items-center gap-1 ${importResult.success ? 'text-green-700' : 'text-destructive'}`}>
                {importResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {importResult.success ? 'Import Successful' : 'Import Completed with Issues'}
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                <div>
                  <p className="text-muted-foreground">Processed</p>
                  <p className="font-bold erp-mono">{importResult.processed}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Skipped</p>
                  <p className="font-bold erp-mono">{importResult.skipped}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-bold erp-mono">{formatCurrency(importResult.totalAmountProcessed)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Timestamp</p>
                  <p className="font-bold erp-mono text-[10px]">{new Date(importResult.timestamp).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-destructive">Errors:</p>
                {importResult.errors.map((e, i) => <p key={i} className="text-destructive/80">• {e}</p>)}
              </div>
            )}
            {importResult.warnings.length > 0 && (
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-amber-700">Warnings:</p>
                {importResult.warnings.map((w, i) => <p key={i} className="text-amber-600">• {w}</p>)}
              </div>
            )}

            <Button size="sm" variant="outline" onClick={handleReset} className="gap-1">
              Upload Another
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <Badge
      variant={active ? 'default' : done ? 'secondary' : 'outline'}
      className={`text-[10px] ${active ? '' : done ? 'bg-green-100 text-green-800 border-green-300' : 'text-muted-foreground'}`}
    >
      {done && !active && <CheckCircle2 className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );
}
