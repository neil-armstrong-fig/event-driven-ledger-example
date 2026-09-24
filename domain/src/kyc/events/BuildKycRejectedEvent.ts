import type {KycRejectedEventDetail} from "./types/KycRejectedEventDetail";

export function buildKycRejectedEvent({
  assetId,
  idempotencyKey,
  customerId,
  reason,
}: KycRejectedEventDetail): KycRejectedEventDetail {
  return {assetId, idempotencyKey, customerId, reason};
}
