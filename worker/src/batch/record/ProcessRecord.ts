import {buildKycPassedEvent} from "@ledger/domain/kyc/events/BuildKycPassedEvent";
import {buildKycRejectedEvent} from "@ledger/domain/kyc/events/BuildKycRejectedEvent";
import {evaluateKyc} from "@ledger/domain/kyc/EvaluateKyc";
import {extractCustomerId} from "@ledger/domain/message/ExtractCustomerId";
import {extractIdempotencyKey} from "@ledger/domain/message/ExtractIdempotencyKey";

import type {LedgerRequestBody} from "@src/batch/record/LedgerRequestBody";
import type {LedgerBatchDependencies} from "@src/batch/types/LedgerBatchDependencies";
import type {LedgerBatchRecord} from "@src/batch/types/LedgerBatchRecord";
import type {RequestRecord} from "@src/batch/types/RequestRecord";

export async function processRecord(
  record: LedgerBatchRecord,
  dependencies: LedgerBatchDependencies,
): Promise<boolean> {
  try {
    const idempotencyKey = extractIdempotencyKey(record);
    const customerId = extractCustomerId(record);
    const {assetId} = JSON.parse(record.body) as LedgerRequestBody;

    const status = await dependencies.getKycStatus(customerId);
    const now = dependencies.now();
    const decision = evaluateKyc({status, now});

    // Recorded first, and announced from what is on file rather than from `decision`: a repeat of the key
    // replays the original decision even if the customer's KYC has changed since (docs/decisions/0003-kyc-gating.md).
    // It is announced on a repeat too, because if a previous attempt recorded it but failed to publish, the
    // redelivery is the only chance to emit (docs/decisions/0002-dual-write.md).
    const onFile = await dependencies.recordRequest({
      idempotencyKey,
      customerId,
      assetId,
      decision,
      ...(status && {kycStatus: status.status}),
      decidedAt: now.toISOString(),
    });
    await announce(onFile, dependencies);
    return true;
  } catch {
    return false;
  }
}

function announce(onFile: RequestRecord, dependencies: LedgerBatchDependencies): Promise<void> {
  const {assetId, idempotencyKey, customerId, decision} = onFile;

  if (decision.outcome === "passed") {
    return dependencies.publishKycPassed(buildKycPassedEvent({assetId, idempotencyKey, customerId}));
  }
  return dependencies.publishKycRejected(
    buildKycRejectedEvent({assetId, idempotencyKey, customerId, reason: decision.reason}),
  );
}
