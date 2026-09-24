import type {KycDecision} from "@ledger/domain/kyc/types/KycDecision";
import type {KycStatus} from "@ledger/shared/kyc/KycStatus";

/**
 * What the idempotency table keeps for a request (docs/decisions/0003-kyc-gating.md): the decision and
 * what it rested on, so a repeat of the key replays it and an audit can see what was known at the time.
 */
export interface RequestRecord {
  idempotencyKey: string;
  customerId: string;
  assetId: string;
  decision: KycDecision;
  /** The customer's KYC status when this was decided; absent when the ledger had nothing on them. */
  kycStatus?: KycStatus;
  /** ISO 8601. */
  decidedAt: string;
}
