# AGENTS.md — worker

The SQS-batch Lambda handler: wires `domain`'s pure logic to real AWS SDK calls — see the root
`AGENTS.md` package table. The `src/` root is the table of contents; everything else sits in a subfolder named for its subject. This package is built at Phase 5, after `domain`
(Phase 3) and `infra` (Phase 4) both exist — the handler needs `domain`'s idempotency/event-shaping
functions and needs `infra`'s resource shapes (queue, table, bus) settled first.

## Source layout

```
src/
├── HandleLedgerBatch.ts            Lambda entry (infra bundles this file by path — don't move it)
├── batch/                          the tested logic: no AWS SDK, dependencies injected
│   ├── ProcessLedgerBatch.ts       walks the batch, applies the FIFO partial-failure rule
│   ├── ProcessLedgerBatch.test.ts
│   ├── record/                     handling one SQS record
│   │   ├── ProcessRecord.ts        record the key, then emit the event (both paths — Gap #2)
│   │   └── LedgerRequestBody.ts
│   └── types/                      the batch's shapes (record, response, outcome, dependencies)
├── aws/                            the thin SDK adapter — no unit test; proven by Phase 6 acceptance tests
│   ├── CreateLedgerDependencies.ts wires the two calls below into the batch's dependencies
│   ├── dynamodb/RecordRequest.ts   conditional PutItem → "recorded" | "already-recorded"
│   └── eventbridge/PublishKycPassed.ts
└── environment/RequireEnv.ts       fail-fast env var read
```

Imports use the `@src/*` alias, never `../`. esbuild honours it when `infra` bundles the entry (checked
with `pnpm synth`).

## Import boundary

`eslint.config.js`: `allowedPackages: ["@ledger/domain", "@ledger/shared"]`. Unlike `domain`, this
package is _expected_ to import AWS SDK packages directly (`@aws-sdk/client-dynamodb`,
`@aws-sdk/client-eventbridge`, etc.) — there's no ban here. The boundary that matters is architectural,
not lint-enforced: keep AWS SDK calls in this package's own handler code, and hand off anything
pure/testable-without-AWS to `domain` instead of duplicating it inline.

## Phase 5 — stop-and-confirm before writing any test

Per `docs/PLAN.md` and `TODO.md`, **step 1 of this phase is a decision, not code**: confirm with the developer
the dual-write approach for Gap #2 before writing a single test.

- **Gap #2 (dual-write)**: decided — on `ConditionalCheckFailedException` from the DynamoDB conditional
  write, the handler still emits `KYC_PASSED_STUB` (at-least-once, consumers must be idempotent). The
  outbox pattern stays a documented-but-unbuilt diagram talking point. See `docs/PLAN.md` Gap #2.
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
