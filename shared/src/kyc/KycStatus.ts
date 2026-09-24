/**
 * Where a customer stands with KYC, as the ledger's status table records it: verified, still pending
 * with the provider, or turned down. Whether a `verified` customer may transact right now also depends
 * on when the verification expires, and that rule is `domain`'s (docs/decisions/0003-kyc-gating.md).
 *
 * Vocabulary rather than a rule: the acceptance specs seed customers with these words, so they must be
 * the same words the worker reads. The list is the source and the type is read off it, so the two
 * cannot drift apart.
 */
export const KYC_STATUSES = ["verified", "pending", "rejected"] as const;

export type KycStatus = (typeof KYC_STATUSES)[number];
