# 0004 — An idempotency key belongs to the customer who sent it

Status: accepted, implemented and proven against LocalStack by `TwoCustomersSharingAnIdempotencyKey.test.ts`

## Context

The idempotency table was keyed on `idempotencyKey` alone ([0001](0001-dedup-vs-idempotency.md)). The key is chosen by the client, so nothing stops two customers using the same string. When customer B sent a key customer A had already used, the conditional write failed, and the worker replayed **A's recorded decision** ([0003](0003-kyc-gating.md)): B's request was never decided, and the event announced for it carried A's `customerId`. Named as a gap in 0003, it is a bug, and a small leak of one customer's outcome to another.

## Decision

**The table is keyed on the customer and their key**: partition key `customerId`, sort key `idempotencyKey`. The conditional write is unchanged, `attribute_not_exists(idempotencyKey)`, but it is now evaluated for one `(customerId, idempotencyKey)` item, so it means "this customer has not used this key". Each customer has their own key namespace: B's request is decided on B's KYC, recorded and announced as B's, and A's record is never read or touched.

**The customer still comes from the transport, never the body** ([0003](0003-kyc-gating.md)). That matters more now: the customer is part of the key, so a caller who could claim someone else's identity could also read or replay that customer's keys.

**Replay is unchanged within a customer.** The same customer repeating a key still gets the decision on record, never a fresh one.

### Why not compare a stored `customerId` on replay

Keeping the key global and rejecting a mismatch on replay needs no schema change, but B could never use a key A has used, and B's own request would get no decision. It also tells B that the key exists. A composite key removes the collision instead of detecting it.

## Consequences

- Changing the key schema replaces the table, which is fine for this ephemeral stack (`RemovalPolicy.DESTROY`, redeployed destroy-first). A live table would need a migration: copy each item across under the new key, then switch the worker.
- The event sink stays keyed on `idempotencyKey` and the event id. Two customers' events for one key share a partition, and a spec tells them apart by the `customerId` each event carries.
- Anything that reads a record needs the customer as well as the key: the acceptance DSL's `records` methods take both.
- A client that reuses one key across customers is now safe; a client that expected a key to be unique across the whole ledger no longer gets that.

## Where this shows up in code

- `infra/src/idempotency/LedgerIdempotencyTable.ts` — the composite key, with its own named assertion in the test beside it.
- `worker/src/aws/dynamodb/RecordRequest.ts` — the conditional write, now per customer; `ProcessRecord.ts` passes the customer through.
- `acceptance-tests/src/tests/requests/TwoCustomersSharingAnIdempotencyKey.test.ts` — one customer verified, one pending, the same key: each is decided and announced as themselves.
