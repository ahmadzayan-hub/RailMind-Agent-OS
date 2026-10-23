/**
 * RailMind Agent OS public contracts.
 *
 * These contracts deliberately contain no model-vendor or agent-framework types.
 * Business workflows depend on RailMind interfaces, not on a specific LLM SDK.
 */

export type RiskClass =
  | 'routine'
  | 'operational'
  | 'contractual'
  | 'financial'
  | 'safety_critical';

export type ActionMode =
  | 'read'
  | 'analyse'
  | 'draft'
  | 'propose_write'
  | 'execute_write'
  | 'control';

export type SourceSystem =
  | 'maximo'
  | 'maximo_finance'
  | 'contract_repository'
  | 'condition_monitoring'
  | 'inspection'
  | 'manual'
  | 'railmind';

export interface EvidenceRef {
  sourceSystem: SourceSystem;
  entityType: string;
  entityId: string;
  observedAt: string;
  /** Optional deep link or canonical source locator. */
  sourceUri?: string;
  /** Optional content hash for immutable evidence snapshots. */
  snapshotHash?: string;
}

export interface SourceFact<T> {
  value: T;
  evidence: EvidenceRef;
  ingestedAt: string;
  quality: 'verified' | 'provisional' | 'rejected';
  qualityNote?: string;
}

export interface AgentTask {
  taskId: string;
  actorId: string;
  goal: string;
  capability: string;
  riskClass: RiskClass;
  actionMode: ActionMode;
  requestedAt: string;
  context?: Readonly<Record<string, unknown>>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  purpose: string;
  capabilities: readonly string[];
  allowedActionModes: readonly ActionMode[];
  allowedToolIds: readonly string[];
  /** LLM use is optional. Deterministic agents can set this to false. */
  mayUseModel: boolean;
  /**
   * Minimum risk class per capability. The kernel escalates a task to at least
   * this class, so a caller cannot downgrade a contractual output to routine.
   */
  minimumRiskClass?: Readonly<Record<string, RiskClass>>;
}

export interface HumanApproval {
  reviewerId: string;
  reviewerRole: string;
  decision: 'approved' | 'rejected';
  at: string;
  note?: string;
}

export interface ExecutionPolicyDecision {
  allowed: boolean;
  approvalRequired: boolean;
  reason: string;
}

export interface AgentExecutionPlan {
  task: AgentTask;
  agent: AgentDefinition;
  policy: ExecutionPolicyDecision;
  toolIds: readonly string[];
}

export interface GroundedAgentOutput<T> {
  taskId: string;
  agentId: string;
  value: T;
  evidence: readonly EvidenceRef[];
  assumptions: readonly string[];
  generatedAt: string;
  humanApproval?: HumanApproval;
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelRequest {
  messages: readonly ModelMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface ModelResponse {
  text: string;
  model: string;
  finishReason?: string;
}

/**
 * RailMind talks to this interface only. A llama.cpp, vLLM, Ollama or hosted
 * OpenAI-compatible endpoint can sit behind it without changing domain code.
 */
export interface ModelGateway {
  generate(request: ModelRequest): Promise<ModelResponse>;
}

/** Classification of the data an agent run handles. Drives model-invocation policy. */
export type DataClassification = 'synthetic' | 'internal' | 'confidential';

export interface ToolCallRecord {
  toolId: string;
  at: string;
  /** Short, non-sensitive description of the call (no payloads). */
  summary: string;
}

export type AgentRunStatus = 'completed' | 'blocked' | 'failed';

/**
 * Full record of one governed agent run: what was planned, which approved
 * tools were called, whether a model was used, the grounded output, and the
 * release decision. Every field is reproducible from the audit trail.
 */
export interface AgentRunRecord {
  runId: string;
  task: AgentTask;
  agentId: string | null;
  status: AgentRunStatus;
  classification: DataClassification;
  startedAt: string;
  completedAt: string;
  toolCalls: readonly ToolCallRecord[];
  modelUsed: boolean;
  output: GroundedAgentOutput<unknown> | null;
  approvalRequired: boolean;
  releaseReady: boolean;
  reason: string;
  auditSequences: readonly number[];
  /** Ledger id of the recommendation record written for a completed run. */
  ledgerId?: string;
  /** Sequence this run belongs to, when it was executed as part of a deterministic chain. */
  sequenceId?: string;
}
