# 0003 — Gate every request on the customer's KYC status, and record the decision

Status: accepted, implemented and proven against LocalStack by the acceptance specs

## Context

`KYC_PASSED_STUB` was announced for every request, whoever sent it. Nothing was checked, and a request did not say who it was from. A real ledger cannot do that: a fractionalisation request is only allowed if the customer has passed KYC (Know Your Customer, the identity and sanctions check a regulated platform must complete before someone transacts).

KYC belongs to the customer, not to the request. It is done once at onboarding, by a provider that answers asynchronously, and it expires. So the ledger needs three things it did not have: who is asking, what their KYC status is, and a durable record of what was decided and why.

## Decision

**Identity comes from the transport, never the body.** API Gateway requires a `Customer-Id` header. In a real deployment that value is the authoriser's output (`$context.authorizer.principalId`); here the header stands in for it, so the VTL template in `infra/src/api/request/LedgerApiRequestTemplate.ts` is the one place that changes when real auth arrives. It travels as the `CustomerId` SQS message attribute, for the same reason `IdempotencyKey` does (0001): a `customerId` in the body is ignored, so a client cannot claim to be someone else.

**The hot path stays Lambda-free.** The API still answers `202` (queued, not processed) for every valid request. The worker makes the decision. A customer who fails KYC is a business outcome, not a fault, so the message is acknowledged and never retried into the DLQ.

**KYC status is a lookup, not a cache.** A `KycTable` keyed on `customerId` holds `status` (`verified`, `pending` or `rejected`) and `expiresAt`. It holds no documents or personal data, only the outcome, which keeps data-protection exposure small; a real feed would add the verification level, when it happened and the provider's reference, and would still never hold the documents. The worker reads it with a strongly consistent `GetItem` for each request and keeps nothing in the Lambda between invocations, so a revocation takes effect on the next request rather than when a cache expires.

**The rule is pure and lives in `domain`.** `evaluateKyc` takes the status record and the current time and returns a decision:

| Status on record | Decision |
|---|---|
| `verified`, not past `expiresAt` | passed |
| `verified`, past `expiresAt` | rejected, reason `expired` |
| `pending` | rejected, reason `pending` |
| `rejected`, or no record at all | rejected, reason `not-verified` |

**The decision is recorded with the idempotency key.** The idempotency item keeps the customer, the asset, the outcome, the reason, the KYC status relied on and when it was decided. A repeat of the same key **replays the recorded decision and never re-evaluates it**: a customer who becomes verified afterwards cannot turn an earlier rejection into a pass, and an audit can show exactly what was known when the request was decided. The worker learns the original decision from the conditional write itself (`ReturnValuesOnConditionCheckFailure: ALL_OLD`).

**Events are `KYC_PASSED` and `KYC_REJECTED`.** The `_STUB` suffix goes because the check is real. Both carry `assetId`, `idempotencyKey` and `customerId`; `KYC_REJECTED` also carries the reason. As in [0002](0002-dual-write.md) the event is emitted on a duplicate as well, but it now carries the **recorded** decision.

## Named gaps (decided, not built)

- **The idempotency key is global, not per customer.** If customer B sends a key customer A already used, B is handed A's recorded decision. Scoping the key to the customer (a composite key, or a stored `customerId` compared on replay) is the fix, and it changes the key semantics of [0001](0001-dedup-vs-idempotency.md), so it is left for its own decision.
- **The status feed is seeded, not event-driven.** Acceptance tests write statuses straight into the table. A real KYC provider would call back, become a `KYC_STATUS_CHANGED` event, and a rule would update the table. That path is documented and unbuilt, like the outbox.
- **`pending` is rejected, not parked.** A request from a customer whose verification is still in flight is rejected with reason `pending`; the client must resubmit under a new key once verified. Holding it until the provider answers would need a state machine this skeleton does not have.

## Consequences

- A request now carries a customer. The `Customer-Id` header is required, and a request without it gets a `400` before it is queued.
- The double-spend and replay guarantees now include the decision: the second request sees what the first was decided as.
- Consumers must handle two events and stay idempotent, as before.
- `domain` gains the first real business rule. It is unit-tested with the clock injected, so expiry needs no waiting.

## Where this shows up in code

- `shared/src/kyc/` — the words: `KycStatus`, `KycRejectionReason`, `KycOutcome`. The acceptance specs assert with the same ones.
- `domain/src/kyc/EvaluateKyc.ts` — the decision table above.
- `worker/src/batch/record/ProcessRecord.ts` — look up, evaluate, record, publish the recorded decision.
- `worker/src/aws/dynamodb/RecordRequest.ts` — stores the decision and returns the original on a duplicate; `GetKycStatus.ts` beside it does the lookup.
- `infra/src/kyc/LedgerKycTable.ts` and `infra/src/api/request/LedgerApiRequestTemplate.ts` — the table and the `Customer-Id` seam.
- `acceptance-tests/src/tests/requests/` — the specs, including one that replays a rejection for a customer verified since and one for a request with no `Customer-Id`.
