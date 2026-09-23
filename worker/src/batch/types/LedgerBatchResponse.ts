import type {LedgerBatchItemFailure} from "@src/batch/types/LedgerBatchItemFailure";

export interface LedgerBatchResponse {
  batchItemFailures: LedgerBatchItemFailure[];
}
