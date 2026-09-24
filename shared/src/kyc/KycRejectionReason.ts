/**
 * Why a request was rejected for KYC, as the `KYC_REJECTED` event names it (docs/decisions/0003-kyc-gating.md):
 * the customer is not verified (rejected, or nothing on record), their verification is still pending,
 * or it has expired.
 *
 * Vocabulary rather than a rule: which customer gets which reason is `domain`'s, but a spec asserts the
 * reason on the event, so both sides need the same words. The list is the source and the type is read off it.
 */
export const KYC_REJECTION_REASONS = ["not-verified", "pending", "expired"] as const;

export type KycRejectionReason = (typeof KYC_REJECTION_REASONS)[number];
