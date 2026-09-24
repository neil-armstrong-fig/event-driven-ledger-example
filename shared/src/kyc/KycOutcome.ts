/**
 * What the ledger decided about a request's KYC (docs/decisions/0003-kyc-gating.md): it passed, or it was
 * rejected. Written on the idempotency record and read back by the acceptance specs.
 *
 * Vocabulary rather than a rule: which of the two a customer gets is `domain`'s, but a spec asserts the
 * outcome on the record, so both sides need the same words. The list is the source and the type is read off it.
 */
export const KYC_OUTCOMES = ["passed", "rejected"] as const;

export type KycOutcome = (typeof KYC_OUTCOMES)[number];
