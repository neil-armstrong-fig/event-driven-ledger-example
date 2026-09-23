# 0002 — Dual write: emit the event on a duplicate too (at-least-once)

Status: accepted

## Context

For each request the worker does two writes that cannot be made atomic: a conditional `PutItem` to DynamoDB, then `PutEvents` to EventBridge. If the first succeeds and the second fails, the message is reported failed and SQS redelivers it. On redelivery the conditional check fails, because the record now exists. A worker that treats that as "already handled, do nothing" never emits the event. The record exists, the event is lost, and nothing detects it.

## Options

- **A. Emit on `ConditionalCheckFailedException` too.** A redelivery after a failed publish gets to publish. Delivery becomes at-least-once: a genuine duplicate request also produces a second event.
- **B. Outbox.** Write the record and the intent to emit together, then let DynamoDB Streams and EventBridge Pipes publish. Exactly the right shape, but more infrastructure than this skeleton warrants.

## Decision

Option A. The worker records the key, and whether it was newly recorded or already there, publishes `KYC_PASSED_STUB`. Any failure in either step fails that message, and every later message in its FIFO group (see the FIFO rule in `worker/src/batch/ProcessLedgerBatch.ts`).

Option B stays on the diagram as a dotted, unbuilt evolution path.

## Consequences

- Consumers must be idempotent. The event carries `idempotencyKey` so they can be.
- The double-spend spec asserts that the key is recorded and that at least two events arrive, all carrying the same key. It cannot assert exactly one event.
- `PutEvents` reports partial failure in its response instead of throwing, so the adapter turns a non-zero `FailedEntryCount` into a throw. Without that a rejected event would look like success and the message would be acknowledged.
- A duplicate request produces an event with no new state behind it. That is the price of not losing the first one.

## Where this shows up in code

- `worker/src/batch/record/ProcessRecord.ts` — emits regardless of the outcome.
- `worker/src/aws/dynamodb/RecordRequest.ts` — maps the condition failure to `"already-recorded"`.
- `worker/src/aws/eventbridge/PublishKycPassed.ts` — the `FailedEntryCount` check.
