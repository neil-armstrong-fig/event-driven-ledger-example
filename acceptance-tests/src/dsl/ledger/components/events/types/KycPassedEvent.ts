/** What a specification sees of an emitted `KYC_PASSED_STUB` event: its business payload only. */
export interface KycPassedEvent {
  assetId: string;
  idempotencyKey: string;
}
