/** What a specification sees of an emitted `KYC_PASSED` event: its business payload only. */
export interface KycPassedEvent {
  assetId: string;
  idempotencyKey: string;
  customerId: string;
}
