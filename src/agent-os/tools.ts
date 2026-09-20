import type { AgentExecutionPlan, ToolCallRecord } from './contracts.ts';

/**
 * Governed tool registry.
 *
 * Tools are the only way an agent reaches data. Every tool is read-only in P0,
 * is registered under the id the catalog refers to, and can only be invoked
 * through a ToolInvoker scoped to an execution plan. A call outside the plan's
 * allowed tool ids is refused before any implementation runs.
 */
export interface ToolDefinition<I = unknown, O = unknown> {
  id: string;
  description: string;
  readOnly: true;
  /** Short, non-sensitive summary of a call for the audit trail. */
  summarise(input: I): string;
  invoke(input: I): Promise<O>;
}

export class ToolRegistry {
  readonly #tools = new Map<string, ToolDefinition<never, unknown>>();

  register<I, O>(tool: ToolDefinition<I, O>): this {
    if (this.#tools.has(tool.id)) throw new Error(`Tool already registered: ${tool.id}`);
    if (tool.readOnly !== true) throw new Error(`P0 tools must be read-only: ${tool.id}`);
    this.#tools.set(tool.id, tool as ToolDefinition<never, unknown>);
    return this;
  }

  has(id: string): boolean {
    return this.#tools.has(id);
  }

  get(id: string): ToolDefinition<never, unknown> | undefined {
    return this.#tools.get(id);
  }

  ids(): readonly string[] {
    return [...this.#tools.keys()];
  }
}

export class ToolAccessError extends Error {
  readonly toolId: string;
  constructor(toolId: string, message: string) {
    super(message);
    this.toolId = toolId;
  }
}

export interface ToolInvoker {
  call<I, O>(toolId: string, input: I): Promise<O>;
  readonly calls: readonly ToolCallRecord[];
}

/**
 * Bounded retry for transient source failures. A source that answers with a
 * server error, a rate limit or a broken connection is retried a small number
 * of times; every retry is reported so the audit trail shows it. Anything
 * else (authorisation, malformed data, boundary violations) fails at once.
 */
export interface RetryPolicy {
  maxAttempts: number;
  sleep?: (ms: number) => Promise<void>;
  delayMs?: (attempt: number) => number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttempts: 3 };

const TRANSIENT = /HTTP (5\d\d|429)|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up|network/i;

export function isTransientSourceError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'SourceUnavailableError') return TRANSIENT.test(error.message);
  return TRANSIENT.test(error.message);
}

export interface ScopedInvokerHooks {
  onCall: (record: ToolCallRecord) => Promise<void>;
  onRetry?: (record: ToolCallRecord, attempt: number, error: Error) => Promise<void>;
  retry?: RetryPolicy;
}

const defaultSleep = (ms: number): Promise<void> => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

export function createScopedInvoker(
  registry: ToolRegistry,
  plan: AgentExecutionPlan,
  onCall: ((record: ToolCallRecord) => Promise<void>) | ScopedInvokerHooks,
  now: () => string,
): ToolInvoker {
  const hooks: ScopedInvokerHooks = typeof onCall === 'function' ? { onCall } : onCall;
  const retry = hooks.retry ?? DEFAULT_RETRY_POLICY;
  const sleep = retry.sleep ?? defaultSleep;
  const delayMs = retry.delayMs ?? ((attempt: number) => 150 * attempt);
  const calls: ToolCallRecord[] = [];
  return {
    calls,
    async call<I, O>(toolId: string, input: I): Promise<O> {
      if (!plan.toolIds.includes(toolId)) {
        throw new ToolAccessError(toolId, `${plan.agent.id} is not allowed to call tool ${toolId}.`);
      }
      const tool = registry.get(toolId) as ToolDefinition<I, O> | undefined;
      if (!tool) throw new ToolAccessError(toolId, `Tool ${toolId} is allowed by the catalog but not registered in this deployment.`);
      const record: ToolCallRecord = { toolId, at: now(), summary: tool.summarise(input) };
      calls.push(record);
      await hooks.onCall(record);
      const maxAttempts = Math.max(1, retry.maxAttempts);
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await tool.invoke(input);
        } catch (error) {
          if (attempt >= maxAttempts || !isTransientSourceError(error)) throw error;
          await hooks.onRetry?.(record, attempt, error as Error);
          await sleep(delayMs(attempt));
        }
      }
    },
  };
}
