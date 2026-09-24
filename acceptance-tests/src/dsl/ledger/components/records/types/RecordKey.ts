/** Which record: an idempotency key is only unique among one customer's requests (docs/decisions/0004-customer-scoped-idempotency.md). */
export interface RecordKey {
  customerId: string;
  idempotencyKey: string;
}
