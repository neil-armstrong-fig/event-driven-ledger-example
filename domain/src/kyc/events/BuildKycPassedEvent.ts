import type {KycPassedEventDetail} from "./types/KycPassedEventDetail";

export function buildKycPassedEvent({assetId, idempotencyKey, customerId}: KycPassedEventDetail): KycPassedEventDetail {
  return {assetId, idempotencyKey, customerId};
}
