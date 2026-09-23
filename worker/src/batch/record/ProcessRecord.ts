import {buildKycPassedEvent} from "@ledger/domain/events/BuildKycPassedEvent";
import {extractIdempotencyKey} from "@ledger/domain/idempotency/ExtractIdempotencyKey";

import type {LedgerRequestBody} from "@src/batch/record/LedgerRequestBody";
import type {LedgerBatchDependencies} from "@src/batch/types/LedgerBatchDependencies";
import type {LedgerBatchRecord} from "@src/batch/types/LedgerBatchRecord";

export async function processRecord(
  record: LedgerBatchRecord,
  dependencies: LedgerBatchDependencies,
): Promise<boolean> {
  try {
    const idempotencyKey = extractIdempotencyKey(record);
    const {assetId} = JSON.parse(record.body) as LedgerRequestBody;

    // The event is emitted whether the key was newly recorded or already there: if a previous attempt
    // recorded it but failed to publish, the redelivery is the only chance to emit (docs/PLAN.md Gap #2).
    await dependencies.recordRequest(idempotencyKey);
    await dependencies.publishKycPassed(buildKycPassedEvent({assetId, idempotencyKey}));
    return true;
  } catch {
    return false;
  }
}
