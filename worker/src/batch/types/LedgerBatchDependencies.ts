import type {KycPassedEventDetail} from "@ledger/domain/events/KycPassedEventDetail";

import type {RecordOutcome} from "@src/batch/types/RecordOutcome";

export interface LedgerBatchDependencies {
  // Conditional put keyed on the idempotency key; an existing key is "already-recorded", not an error.
  recordRequest(idempotencyKey: string): Promise<RecordOutcome>;
  publishKycPassed(detail: KycPassedEventDetail): Promise<void>;
}
