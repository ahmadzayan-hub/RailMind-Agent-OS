/**
 * Authenticated principals, roles, permissions and scopes.
 *
 * Runtime rule: every protected API request resolves identity, role, scope
 * and permission on the server. The audit trail records the principal id and
 * role from the token directory, never a caller-supplied name.
 */
export type Role =
  | 'viewer'
  | 'maintenance_engineer'
  | 'reliability_engineer'
  | 'contract_manager'
  | 'finance_reviewer'
  | 'approver'
  | 'administrator';

export type Permission =
  | 'report.read'
  | 'report.submit'
  | 'report.approve'
  | 'report.reject'
  | 'report.lock'
  | 'report.reset'
  | 'agent.plan'
  | 'agent.run:maintenance'
  | 'agent.run:asset'
  | 'agent.run:contract'
  | 'agent.run:finance'
  | 'audit.read'
  | 'runs.read'
  | 'agents.read'
  | 'ledger.read'
  | 'review.comment'
  | 'review.resolve';

export type ScopeType = 'system' | 'line' | 'asset_group' | 'contract' | 'portfolio' | 'business_area';

export interface Scope {
  type: ScopeType;
  /** Identifier within the type; omitted for `system`. */
  id?: string;
}

/** Which side of the contract a principal speaks for in reviews. Absent for principals that must declare it per action (administrators). */
export type Party = 'owner' | 'contractor';

export interface Principal {
  principalId: string;
  displayName: string;
  role: Role;
  scopes: readonly Scope[];
  party?: Party;
}

const READ: readonly Permission[] = ['report.read', 'audit.read', 'runs.read', 'agents.read', 'ledger.read'];
const MAINTENANCE: readonly Permission[] = [...READ, 'agent.plan', 'agent.run:maintenance', 'agent.run:asset', 'report.submit', 'review.comment'];
const RELIABILITY: readonly Permission[] = [...READ, 'agent.plan', 'agent.run:asset', 'agent.run:maintenance', 'review.comment'];
const CONTRACT: readonly Permission[] = [...READ, 'agent.plan', 'agent.run:contract', 'agent.run:maintenance', 'report.submit', 'review.comment'];
const FINANCE: readonly Permission[] = [...READ, 'agent.plan', 'agent.run:finance', 'review.comment'];
const APPROVER: readonly Permission[] = [...READ, 'report.approve', 'report.reject', 'report.lock', 'review.comment', 'review.resolve'];
const ADMIN: readonly Permission[] = [...new Set([...MAINTENANCE, ...RELIABILITY, ...CONTRACT, ...FINANCE, ...APPROVER, 'report.reset' as Permission])];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  viewer: READ,
  maintenance_engineer: MAINTENANCE,
  reliability_engineer: RELIABILITY,
  contract_manager: CONTRACT,
  finance_reviewer: FINANCE,
  approver: APPROVER,
  administrator: ADMIN,
};

export const ROLES: readonly Role[] = ['viewer', 'maintenance_engineer', 'reliability_engineer', 'contract_manager', 'finance_reviewer', 'approver', 'administrator'];
export const SCOPE_TYPES: readonly ScopeType[] = ['system', 'line', 'asset_group', 'contract', 'portfolio', 'business_area'];
export const PARTIES: readonly Party[] = ['owner', 'contractor'];

export function isParty(value: unknown): value is Party {
  return typeof value === 'string' && (PARTIES as readonly string[]).includes(value);
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function isScopeType(value: unknown): value is ScopeType {
  return typeof value === 'string' && (SCOPE_TYPES as readonly string[]).includes(value);
}

export function permissionsOf(principal: Principal): readonly Permission[] {
  return ROLE_PERMISSIONS[principal.role];
}

export function hasPermission(principal: Principal, permission: Permission): boolean {
  return ROLE_PERMISSIONS[principal.role].includes(permission);
}

/** A principal may act on a resource when it holds the system scope or a scope of the same type and id. */
export function inScope(principal: Principal, required: Scope): boolean {
  return principal.scopes.some((scope) => scope.type === 'system' || (scope.type === required.type && (required.id === undefined || scope.id === required.id)));
}

/** Maps report transitions to the permission they require. */
export const TRANSITION_PERMISSION: Readonly<Record<'submit_for_review' | 'approve' | 'reject' | 'lock' | 'supersede' | 'revise', Permission>> = {
  submit_for_review: 'report.submit',
  approve: 'report.approve',
  reject: 'report.reject',
  lock: 'report.lock',
  supersede: 'report.approve',
  revise: 'report.submit',
};

/** Capability groups drive the run permission a capability needs. */
const CAPABILITY_GROUP: Readonly<Record<string, Permission>> = {
  'data-quality': 'agent.run:maintenance',
  'maintenance-kpi': 'agent.run:maintenance',
  'exception-analysis': 'agent.run:maintenance',
  'asset-health': 'agent.run:asset',
  'failure-risk': 'agent.run:asset',
  'maintenance-priority': 'agent.run:asset',
  'monthly-report': 'agent.run:contract',
  'quarterly-report': 'agent.run:contract',
  'annual-report': 'agent.run:contract',
  'executive-briefing': 'agent.run:contract',
  'contract-context': 'agent.run:contract',
  'finance-context': 'agent.run:finance',
};

export function runPermissionFor(capability: string): Permission {
  return CAPABILITY_GROUP[capability] ?? 'agent.run:maintenance';
}
