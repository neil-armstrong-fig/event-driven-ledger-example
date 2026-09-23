# AGENTS.md — worker

The SQS-batch Lambda handler: wires `domain`'s pure logic to real AWS SDK calls — see the root
`AGENTS.md` package table. `src/` holds only a placeholder `HandleLedgerBatch.ts` (returns no failures) so `infra` has an entry to bundle; Phase 5 replaces it test-first. This package is built at Phase 5, after `domain`
(Phase 3) and `infra` (Phase 4) both exist — the handler needs `domain`'s idempotency/event-shaping
functions and needs `infra`'s resource shapes (queue, table, bus) settled first.

## Import boundary

`eslint.config.js`: `allowedPackages: ["@ledger/domain", "@ledger/shared"]`. Unlike `domain`, this
package is _expected_ to import AWS SDK packages directly (`@aws-sdk/client-dynamodb`,
`@aws-sdk/client-eventbridge`, etc.) — there's no ban here. The boundary that matters is architectural,
not lint-enforced: keep AWS SDK calls in this package's own handler code, and hand off anything
pure/testable-without-AWS to `domain` instead of duplicating it inline.

## Phase 5 — stop-and-confirm before writing any test

Per `docs/PLAN.md` and `TODO.md`, **step 1 of this phase is a decision, not code**: confirm with the developer
the dual-write approach for Gap #2 before writing a single test.

- **Gap #2 (dual-write)**: on `ConditionalCheckFailedException` from the DynamoDB conditional write,
  does the handler still emit `KYC_PASSED_STUB` (at-least-once, consumers must be idempotent — the
  cheaper in-scope fix) or is that path left as a documented-but-unbuilt outbox-pattern diagram talking
  point? Not yet decided — see `docs/PLAN.md` Gap #2 for the full tradeoff.
- **Gap #1 (dedup vs. idempotency)** is already resolved by design and proven in the Phase 1 spike:
  the double-spend test sends the same `Idempotency-Key` **message attribute** (never body-spliced —
  see the root `AGENTS.md` gotchas) with a differing `requestId` in the body, so SQS content-based dedup
  lets both through and the DynamoDB conditional write is what actually blocks the second one. No
  further decision needed here, just implement the handler so this is what happens.

Only after that confirmation: write the failing batch-handler tests (step 2), then implement to green
(step 3), including **FIFO partial-batch-failure semantics** — per `reportBatchItemFailures`'s FIFO
rules, once one message in a `MessageGroupId` fails, every later message in that same group in the
batch must also be reported as failed, not just the one that errored.

## Reading the idempotency key

`record.messageAttributes.IdempotencyKey.stringValue` — never parse it out of the message body. See
the root `AGENTS.md` gotchas for why (VTL parse error was the reason it isn't in the body at all).
