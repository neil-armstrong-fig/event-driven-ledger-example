/** A decision as the idempotency table holds it: plain strings, not yet known to be a real outcome or reason. */
export interface StoredKycDecision {
  outcome: string;
  reason?: string;
}
