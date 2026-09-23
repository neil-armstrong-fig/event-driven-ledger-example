import type {KycPassedEventDetail} from "./KycPassedEventDetail";

export function buildKycPassedEvent({assetId, idempotencyKey}: KycPassedEventDetail): KycPassedEventDetail {
  return {assetId, idempotencyKey};
}
