import type { CapabilityHandler } from '../agent-os/handlers.ts';
import { createAssetHealthHandler, createFailureRiskHandler, createMaintenancePriorityHandler } from './asset-intelligence.ts';
import { createContractContextHandler } from './contract-context.ts';
import { createDataQualityHandler } from './data-quality.ts';
import { createFinanceContextHandler } from './finance-context.ts';
import { createExceptionAnalysisHandler, createMaintenanceKpiHandler } from './maintenance-kpi.ts';
import { createExecutiveBriefingHandler, createReportingHandler } from './reporting.ts';
import type { AnalysisScope } from './scope.ts';

/** Executable handlers for every catalog capability. A catalog capability without a handler would fail closed at run time. */
export function createStandardHandlers(defaults: AnalysisScope): readonly CapabilityHandler[] {
  return [
    createDataQualityHandler(defaults),
    createMaintenanceKpiHandler(defaults),
    createExceptionAnalysisHandler(defaults),
    createReportingHandler('monthly', defaults),
    createReportingHandler('quarterly', defaults),
    createReportingHandler('annual', defaults),
    createExecutiveBriefingHandler(defaults),
    createAssetHealthHandler(),
    createFailureRiskHandler(),
    createMaintenancePriorityHandler(),
    createContractContextHandler(defaults),
    createFinanceContextHandler(defaults),
  ];
}

export * from './asset-intelligence.ts';
export * from './contract-context.ts';
export * from './data-quality.ts';
export * from './finance-context.ts';
export * from './maintenance-kpi.ts';
export * from './reporting.ts';
export * from './scope.ts';
