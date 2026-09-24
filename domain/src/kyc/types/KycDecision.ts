import type {KycOutcome} from "@ledger/shared/kyc/KycOutcome";
import type {KycRejectionReason} from "@ledger/shared/kyc/KycRejectionReason";

interface KycPassedDecision {
  outcome: Extract<KycOutcome, "passed">;
}

interface KycRejectedDecision {
  outcome: Extract<KycOutcome, "rejected">;
  reason: KycRejectionReason;
}

export type KycDecision = KycPassedDecision | KycRejectedDecision;
