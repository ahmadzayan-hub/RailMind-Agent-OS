import type { ReportPackage } from './contracts.ts';

/**
 * Report registry.
 *
 * A deployment serves one or more report packages, each bound to a contract
 * and a reporting period. The registry is the single list of packages the
 * API may address: an unregistered report id is refused, and every request
 * for a package is scope-checked against the contract the package belongs
 * to. The first registration is the default package (the one the preview
 * and legacy single-report routes address).
 */
export interface ReportRegistration {
  /** Seed package: restored by reset and used when the store holds no state for it. */
  seed: ReportPackage;
  /** Prior breach counts per KPI id from the previous approved periods. */
  priorBreachesByKpi?: Readonly<Record<string, number>>;
}

export interface ReportScope {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  priorBreachesByKpi?: Readonly<Record<string, number>>;
}

export interface ReportRegistry {
  readonly default: ReportRegistration;
  get(reportId: string): ReportRegistration | null;
  list(): readonly ReportRegistration[];
  forContract(contractId: string): readonly ReportRegistration[];
  contractIds(): readonly string[];
}

/** The scope a registered package is computed for. */
export function scopeOf(registration: ReportRegistration): ReportScope {
  const { contractId, periodStart, periodEnd } = registration.seed;
  return registration.priorBreachesByKpi ? { contractId, periodStart, periodEnd, priorBreachesByKpi: registration.priorBreachesByKpi } : { contractId, periodStart, periodEnd };
}

export function createReportRegistry(registrations: readonly ReportRegistration[]): ReportRegistry {
  if (registrations.length === 0) throw new Error('A report registry requires at least one registered package.');
  const byId = new Map<string, ReportRegistration>();
  for (const registration of registrations) {
    const { reportId, periodStart, periodEnd } = registration.seed;
    if (byId.has(reportId)) throw new Error(`Report ${reportId} is registered twice.`);
    if (Number.isNaN(Date.parse(periodStart)) || Number.isNaN(Date.parse(periodEnd)) || periodStart >= periodEnd) throw new Error(`Report ${reportId} has an invalid period.`);
    byId.set(reportId, registration);
  }
  const all = [...byId.values()];
  return {
    default: all[0]!,
    get: (reportId) => byId.get(reportId) ?? null,
    list: () => all,
    forContract: (contractId) => all.filter((r) => r.seed.contractId === contractId),
    contractIds: () => [...new Set(all.map((r) => r.seed.contractId))],
  };
}
