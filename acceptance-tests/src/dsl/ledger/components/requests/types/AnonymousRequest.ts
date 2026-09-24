/** A request as far as the client can write it: everything except who it is from, which the caller's identity supplies. */
export interface AnonymousRequest {
  idempotencyKey: string;
  assetId: string;
  requestId: string;
}
