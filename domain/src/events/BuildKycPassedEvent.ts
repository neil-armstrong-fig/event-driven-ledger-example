export interface KycPassedEventDetail {
  assetId: string;
  idempotencyKey: string;
}

export function buildKycPassedEvent({assetId, idempotencyKey}: KycPassedEventDetail): KycPassedEventDetail {
  return {assetId, idempotencyKey};
}
