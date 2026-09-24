import type {KycRejectionReason} from "@ledger/shared/kyc/KycRejectionReason";

/** What a specification sees of an emitted `KYC_REJECTED` event: its business payload only. */
export interface KycRejectedEvent {
  assetId: string;
  idempotencyKey: string;
  customerId: string;
  reason: KycRejectionReason;
}
