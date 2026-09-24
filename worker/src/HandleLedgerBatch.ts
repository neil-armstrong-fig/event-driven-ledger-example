import {createLedgerDependencies} from "@src/aws/CreateLedgerDependencies";
import {processLedgerBatch} from "@src/batch/ProcessLedgerBatch";
import type {LedgerBatchRecord} from "@src/batch/types/LedgerBatchRecord";
import type {LedgerBatchResponse} from "@src/batch/types/LedgerBatchResponse";
import {requireEnv} from "@src/environment/RequireEnv";

interface LedgerBatchEvent {
  Records: LedgerBatchRecord[];
}

// Built once per Lambda container so the SDK clients (and their connections) are reused across invocations.
const dependencies = createLedgerDependencies({
  tableName: requireEnv("LEDGER_TABLE_NAME"),
  kycTableName: requireEnv("LEDGER_KYC_TABLE_NAME"),
  eventBusName: requireEnv("LEDGER_EVENT_BUS_NAME"),
});

export function handleLedgerBatch(event: LedgerBatchEvent): Promise<LedgerBatchResponse> {
  return processLedgerBatch(event.Records, dependencies);
}
