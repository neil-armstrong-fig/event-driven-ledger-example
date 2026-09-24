# 0001 — SQS content-based deduplication is not the idempotency guard

Status: accepted (proven against LocalStack; automated in `DoubleSpendingAFractionalizationRequest.test.ts`)

## Context

The request queue is FIFO with `contentBasedDeduplication: true`. SQS then hashes the message body and silently drops any message whose hash matches one accepted in the last 5 minutes. The API still answers `202`, and the worker never sees the duplicate.

That looks like idempotency, but it is not one:

- It only covers 5 minutes. The DynamoDB record is permanent.
- It compares whole bodies, not the client's `Idempotency-Key`. A retry that differs in any field (say a fresh `requestId`) gets through, and a genuinely different request with an identical body is dropped.
- It gives no signal. Nothing records that a duplicate was discarded.

So two mechanisms could be mistaken for one. The double-spend guarantee has to come from the one that is exact and durable.

## Decision

The guarantee is the DynamoDB conditional write, `PutItem` with `attribute_not_exists(idempotencyKey)`, keyed on the `Idempotency-Key` header. SQS deduplication stays on as a cheap first filter for byte-identical retries, and nothing relies on it.

The header travels as the `IdempotencyKey` SQS message attribute, never inside the body, so the body remains an exact passthrough of the client's request.

The double-spend acceptance spec therefore sends two requests with the **same** `Idempotency-Key` and a **different** `requestId`. SQS sees two distinct messages and delivers both, so the conditional write is what blocks the second. With identical bodies the spec would pass while testing only SQS.

## Consequences

- `requestId` is a required body field. It exists so a client can send a distinct message under a reused key, which puts SQS-dedup mechanics into the public API contract.
- A byte-identical retry never reaches the worker, so it produces no second event. A same-key retry with a different body does reach it (see [0002](0002-dual-write.md)).
- Acceptance tests must generate fresh data per criterion. The stack outlives a run, so reusing a body within 5 minutes is silently dropped: 202, no record, no event.

## Where this shows up in code

- `infra/src/queue/LedgerRequestQueue.ts` — `contentBasedDeduplication`.
- `worker/src/aws/dynamodb/RecordRequest.ts` — the conditional write.
- `domain/src/message/ExtractIdempotencyKey.ts` — the key comes from the attribute, never the body.
