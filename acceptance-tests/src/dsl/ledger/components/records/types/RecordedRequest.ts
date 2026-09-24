import type {KycOutcome} from "@ledger/shared/kyc/KycOutcome";
import type {KycRejectionReason} from "@ledger/shared/kyc/KycRejectionReason";
import type {KycStatus} from "@ledger/shared/kyc/KycStatus";

/** What a specification sees of a request's record: the decision, and what it rested on. */
export interface RecordedRequest {
  customerId: string;
  assetId: string;
  outcome: KycOutcome;
  /** Only a rejection has one. */
  reason?: KycRejectionReason;
  /** The customer's KYC status when it was decided; absent when the ledger had nothing on them. */
  kycStatus?: KycStatus;
  /** ISO 8601. */
  decidedAt: string;
}
