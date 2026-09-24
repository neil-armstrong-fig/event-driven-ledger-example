import type {KycStatus} from "@ledger/shared/kyc/KycStatus";

/** What the ledger holds about a customer's KYC (docs/decisions/0003-kyc-gating.md): the outcome, never the documents behind it. */
export interface KycStatusRecord {
  status: KycStatus;
  /** ISO 8601. A verification stops counting from this moment. */
  expiresAt?: string;
}
