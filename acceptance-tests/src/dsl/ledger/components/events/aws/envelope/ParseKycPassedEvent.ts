import type {KycPassedEvent} from "@src/dsl/ledger/components/events/types/KycPassedEvent";

const KYC_PASSED_DETAIL_TYPE = "KYC_PASSED_STUB";

interface EventBridgeEnvelope {
  "detail-type"?: unknown;
  detail?: Partial<KycPassedEvent>;
}

/** Reads a sink-queue message body (a full EventBridge envelope); undefined if it isn't a KYC_PASSED_STUB. */
export function parseKycPassedEvent(sinkMessageBody: string): KycPassedEvent | undefined {
  const envelope = JSON.parse(sinkMessageBody) as EventBridgeEnvelope;
  const {assetId, idempotencyKey} = envelope.detail ?? {};
  if (envelope["detail-type"] !== KYC_PASSED_DETAIL_TYPE) return undefined;
  if (typeof assetId !== "string" || typeof idempotencyKey !== "string") return undefined;
  return {assetId, idempotencyKey};
}
