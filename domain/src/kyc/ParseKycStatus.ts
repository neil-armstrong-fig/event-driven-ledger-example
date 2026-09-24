import {KYC_STATUSES, type KycStatus} from "@ledger/shared/kyc/KycStatus";

// For what an adapter reads back from storage: a status the ledger does not know is a fault to surface, not to guess at.
export function parseKycStatus(value: string): KycStatus {
  const status = KYC_STATUSES.find(known => known === value);
  if (status === undefined) {
    throw new Error(`Unknown KYC status: ${value}`);
  }
  return status;
}
