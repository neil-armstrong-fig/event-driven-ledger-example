import type {KycStatus} from "@ledger/shared/kyc/KycStatus";

/** What a specification says about a customer's KYC. `expiresAt` (ISO 8601) defaults to a year ahead when verified. */
export interface CustomerKyc {
  customerId: string;
  status: KycStatus;
  expiresAt?: string;
}
