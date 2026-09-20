import type { EvidenceRef } from '../agent-os/contracts.ts';
import type { CapabilityHandler, CapabilityResult } from '../agent-os/handlers.ts';
import type { FinanceReadInput } from '../agent-os/standard-tools.ts';
import type { MaximoInvoiceRecord } from '../connectors/maximo/port.ts';
import { resolveScope, type AnalysisScope } from './scope.ts';

/**
 * Finance Context Agent. Deterministic, read-only view of invoice and
 * workflow state for a contract period through finance.read. The finance
 * workflow stays authoritative: this handler counts and flags, it never
 * approves, rejects or reconciles an invoice, and it uses no model.
 */
export type FinanceFlagCode = 'missing_invoice_date' | 'approved_exceeds_gross' | 'unknown_status' | 'mixed_currency';

export interface FinanceFlag {
  code: FinanceFlagCode;
  invoiceId: string | null;
  detail: string;
}

export interface FinanceInvoiceSummary {
  invoiceId: string;
  status: string;
  workflowState: string | null;
  invoiceDate: string | null;
  grossAmount: number | null;
  approvedAmount: number | null;
  currency: string | null;
  vendorId: string | null;
}

export interface FinanceContextValue {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  invoiceCount: number;
  byStatus: Readonly<Record<string, number>>;
  byWorkflowState: Readonly<Record<string, number>>;
  totals: { gross: number; approved: number; currency: string | null };
  invoices: readonly FinanceInvoiceSummary[];
  flags: readonly FinanceFlag[];
  provisional: boolean;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function summariseInvoices(invoices: readonly MaximoInvoiceRecord[]): Omit<FinanceContextValue, 'contractId' | 'periodStart' | 'periodEnd'> {
  const byStatus: Record<string, number> = {};
  const byWorkflowState: Record<string, number> = {};
  const flags: FinanceFlag[] = [];
  const currencies = new Set<string>();
  let gross = 0;
  let approved = 0;
  for (const invoice of invoices) {
    const status = invoice.status?.trim() ? invoice.status.toUpperCase() : 'UNKNOWN';
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    const workflow = invoice.workflowState?.trim() ? invoice.workflowState.toUpperCase() : 'NONE';
    byWorkflowState[workflow] = (byWorkflowState[workflow] ?? 0) + 1;
    if (status === 'UNKNOWN') flags.push({ code: 'unknown_status', invoiceId: invoice.invoiceId, detail: 'Invoice has no status in the source extract.' });
    if (!invoice.invoiceDate) flags.push({ code: 'missing_invoice_date', invoiceId: invoice.invoiceId, detail: 'Invoice has no date and cannot be placed in a period.' });
    if (typeof invoice.grossAmount === 'number' && typeof invoice.approvedAmount === 'number' && invoice.approvedAmount > invoice.grossAmount) {
      flags.push({ code: 'approved_exceeds_gross', invoiceId: invoice.invoiceId, detail: `Approved amount ${invoice.approvedAmount} exceeds gross amount ${invoice.grossAmount}.` });
    }
    if (invoice.currency) currencies.add(invoice.currency.toUpperCase());
    gross += invoice.grossAmount ?? 0;
    approved += invoice.approvedAmount ?? 0;
  }
  if (currencies.size > 1) flags.push({ code: 'mixed_currency', invoiceId: null, detail: `Invoices carry ${currencies.size} currencies (${[...currencies].join(', ')}); totals are not comparable.` });
  return {
    invoiceCount: invoices.length,
    byStatus,
    byWorkflowState,
    totals: { gross: round2(gross), approved: round2(approved), currency: currencies.size === 1 ? [...currencies][0] ?? null : null },
    invoices: invoices.map((i) => ({ invoiceId: i.invoiceId, status: i.status, workflowState: i.workflowState ?? null, invoiceDate: i.invoiceDate ?? null, grossAmount: i.grossAmount ?? null, approvedAmount: i.approvedAmount ?? null, currency: i.currency ?? null, vendorId: i.vendorId ?? null })),
    flags,
    provisional: flags.length > 0,
  };
}

export function createFinanceContextHandler(defaults: AnalysisScope): CapabilityHandler<FinanceContextValue> {
  return {
    capability: 'finance-context',
    async execute(context): Promise<CapabilityResult<FinanceContextValue>> {
      const scope = resolveScope(context.task, defaults);
      const invoices = await context.tools.call<FinanceReadInput, readonly MaximoInvoiceRecord[]>('finance.read', { contractId: scope.contractId, since: scope.periodStart });
      const inPeriod = invoices.filter((i) => !i.invoiceDate || i.invoiceDate <= scope.periodEnd);
      const summary = summariseInvoices(inPeriod);
      const evidence: EvidenceRef[] = inPeriod.map((i) => ({ sourceSystem: 'maximo_finance' as const, entityType: 'invoice', entityId: i.invoiceId, observedAt: i.invoiceDate ?? scope.periodEnd }));
      if (evidence.length === 0) {
        /* No invoices is a valid, grounded finding; the contract scope itself is the evidence of the empty read. */
        evidence.push({ sourceSystem: 'maximo_finance', entityType: 'invoice-query', entityId: `${scope.contractId}/${scope.periodStart.slice(0, 10)}..${scope.periodEnd.slice(0, 10)}`, observedAt: context.now() });
      }
      return {
        value: { contractId: scope.contractId, periodStart: scope.periodStart, periodEnd: scope.periodEnd, ...summary },
        evidence,
        assumptions: [
          'Finance workflow remains authoritative; this view counts and flags invoices and takes no financial action.',
          'Invoices without a date are included and flagged; invoices dated after the period end are excluded.',
          summary.provisional ? `Provisional: ${summary.flags.length} flag(s) raised.` : 'No finance data-quality flags.',
        ],
      };
    },
  };
}
