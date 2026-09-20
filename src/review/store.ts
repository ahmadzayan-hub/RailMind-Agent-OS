import type { Disagreement, ReviewComment } from './contracts.ts';

/** RailMind-owned review state. Every transition is also audited and, for disagreements, recorded in the ledger. */
export interface ReviewStore {
  saveComment(comment: ReviewComment): Promise<void>;
  getComment(commentId: string): Promise<ReviewComment | null>;
  listComments(reportId: string): Promise<readonly ReviewComment[]>;
  saveDisagreement(disagreement: Disagreement): Promise<void>;
  getDisagreement(disagreementId: string): Promise<Disagreement | null>;
  listDisagreements(reportId: string): Promise<readonly Disagreement[]>;
  /** Total records, used to mint ids. */
  count(): Promise<{ comments: number; disagreements: number }>;
}

export class InMemoryReviewStore implements ReviewStore {
  readonly #comments = new Map<string, ReviewComment>();
  readonly #disagreements = new Map<string, Disagreement>();

  async saveComment(comment: ReviewComment): Promise<void> { this.#comments.set(comment.commentId, comment); }
  async getComment(commentId: string): Promise<ReviewComment | null> { return this.#comments.get(commentId) ?? null; }
  async listComments(reportId: string): Promise<readonly ReviewComment[]> { return [...this.#comments.values()].filter((c) => c.reportId === reportId); }
  async saveDisagreement(disagreement: Disagreement): Promise<void> { this.#disagreements.set(disagreement.disagreementId, disagreement); }
  async getDisagreement(disagreementId: string): Promise<Disagreement | null> { return this.#disagreements.get(disagreementId) ?? null; }
  async listDisagreements(reportId: string): Promise<readonly Disagreement[]> { return [...this.#disagreements.values()].filter((d) => d.reportId === reportId); }
  async count(): Promise<{ comments: number; disagreements: number }> { return { comments: this.#comments.size, disagreements: this.#disagreements.size }; }
}
