import type { ModelGateway, ModelRequest, ModelResponse } from './contracts.ts';

/**
 * Model gateway guard. A model is optional in every RailMind capability:
 * facts are deterministic and the model only drafts wording. When the
 * configured endpoint fails, the guard retries within a small bound, records
 * the failure through the runtime, and raises ModelUnavailableError so the
 * handler can fall back to its deterministic output instead of failing the
 * run.
 */
export class ModelUnavailableError extends Error {
  readonly attempts: number;
  constructor(message: string, attempts: number) {
    super(message);
    this.attempts = attempts;
  }
}

export interface ModelGuardOptions {
  maxAttempts?: number;
  onFailure?: (attempt: number, error: Error, final: boolean) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  delayMs?: (attempt: number) => number;
}

const defaultSleep = (ms: number): Promise<void> => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

export function createGuardedModel(gateway: ModelGateway, options: ModelGuardOptions = {}): ModelGateway {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const sleep = options.sleep ?? defaultSleep;
  const delayMs = options.delayMs ?? ((attempt: number) => 200 * attempt);
  return {
    async generate(request: ModelRequest): Promise<ModelResponse> {
      let last: Error = new Error('Model gateway failed.');
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          return await gateway.generate(request);
        } catch (error) {
          last = error instanceof Error ? error : new Error(String(error));
          const final = attempt === maxAttempts;
          await options.onFailure?.(attempt, last, final);
          if (!final) await sleep(delayMs(attempt));
        }
      }
      throw new ModelUnavailableError(`Model gateway unavailable after ${maxAttempts} attempt(s): ${last.message}`, maxAttempts);
    },
  };
}
