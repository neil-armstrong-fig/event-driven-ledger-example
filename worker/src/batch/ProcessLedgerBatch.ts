import {processRecord} from "@src/batch/record/ProcessRecord";
import type {LedgerBatchDependencies} from "@src/batch/types/LedgerBatchDependencies";
import type {LedgerBatchItemFailure} from "@src/batch/types/LedgerBatchItemFailure";
import type {LedgerBatchRecord} from "@src/batch/types/LedgerBatchRecord";
import type {LedgerBatchResponse} from "@src/batch/types/LedgerBatchResponse";

// Records are handled in order, one at a time: FIFO ordering is per message group, and once a record
// fails every later record in its group must be reported failed too (reportBatchItemFailures' FIFO rule).
export async function processLedgerBatch(
  records: LedgerBatchRecord[],
  dependencies: LedgerBatchDependencies,
): Promise<LedgerBatchResponse> {
  const failedGroups = new Set<string>();
  const batchItemFailures: LedgerBatchItemFailure[] = [];

  for (const record of records) {
    const groupId = record.attributes.MessageGroupId;
    const succeeded = !failedGroups.has(groupId) && (await processRecord(record, dependencies));

    if (!succeeded) {
      failedGroups.add(groupId);
      batchItemFailures.push({itemIdentifier: record.messageId});
    }
  }

  return {batchItemFailures};
}
