import type {KycRejectionReason} from "@ledger/shared/kyc/KycRejectionReason";

export interface KycRejectedEventDetail {
  assetId: string;
  idempotencyKey: string;
  customerId: string;
  reason: KycRejectionReason;
}
