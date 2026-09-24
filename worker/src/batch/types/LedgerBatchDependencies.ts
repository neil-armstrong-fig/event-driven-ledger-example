import type {KycPassedEventDetail} from "@ledger/domain/kyc/events/types/KycPassedEventDetail";
import type {KycRejectedEventDetail} from "@ledger/domain/kyc/events/types/KycRejectedEventDetail";
import type {KycStatusRecord} from "@ledger/domain/kyc/types/KycStatusRecord";

import type {RequestRecord} from "@src/batch/types/RequestRecord";

export interface LedgerBatchDependencies {
  // A strongly consistent read of the ledger's own status table, never a cache, so a revocation counts at once.
  getKycStatus(customerId: string): Promise<KycStatusRecord | undefined>;
  now(): Date;
  // Conditional put keyed on the idempotency key. Resolves to the record now on file: the one just written,
  // or, when the key was already there, the original — which is not an error, and is never re-decided.
  recordRequest(record: RequestRecord): Promise<RequestRecord>;
  publishKycPassed(detail: KycPassedEventDetail): Promise<void>;
  publishKycRejected(detail: KycRejectedEventDetail): Promise<void>;
}
