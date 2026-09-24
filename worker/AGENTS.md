# AGENTS.md — worker

The SQS-batch Lambda handler: wires `domain`'s pure logic to real AWS SDK calls — see the root
`AGENTS.md` package table. The `src/` root is the table of contents; everything else sits in a subfolder named for its subject.

## Source layout

```
src/
├── HandleLedgerBatch.ts            Lambda entry (infra bundles this file by path — don't move it)
├── batch/                          the tested logic: no AWS SDK, dependencies injected
│   ├── ProcessLedgerBatch.ts       walks the batch, applies the FIFO partial-failure rule
│   ├── ProcessLedgerBatch.test.ts  told as a story: a verified customer, one who has not passed KYC,
│   │                               a key already decided, a body that claims to be someone else, the FIFO rule
│   ├── record/                     handling one SQS record
│   │   ├── ProcessRecord.ts        look up KYC, decide, record, then announce what is on file (0002, 0003)
│   │   └── LedgerRequestBody.ts
│   └── types/                      the batch's shapes (record, response, dependencies, RequestRecord)
├── aws/                            the thin SDK adapter — no unit test; proven by the acceptance tests
│   ├── CreateLedgerDependencies.ts wires the calls below into the batch's dependencies
│   ├── dynamodb/                   GetKycStatus (consistent read), RecordRequest (conditional PutItem of the
│   │                               decision → the record now on file), RequireStringAttribute
│   └── eventbridge/                PublishEvent (the shared FailedEntryCount check), PublishKycPassed, PublishKycRejected
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

## The named decisions

- **Gap #2 (dual-write)**: decided — on `ConditionalCheckFailedException` from the DynamoDB conditional
  write, the handler still announces (at-least-once, consumers must be idempotent), and what it announces
  is the decision that was originally recorded. The outbox pattern stays a documented-but-unbuilt diagram
  talking point. See `docs/decisions/0002-dual-write.md`.
- **Gap #1 (dedup vs. idempotency)** is resolved by design (`docs/decisions/0001-dedup-vs-idempotency.md`):
  the double-spend test sends the same `Idempotency-Key` **message attribute** (never body-spliced —
  see the root `AGENTS.md` gotchas) with a differing `requestId` in the body, so SQS content-based dedup
  lets both through and the DynamoDB conditional write is what actually blocks the second one. The
  handler must keep this behaviour.

The handler also implements **FIFO partial-batch-failure semantics** — per `reportBatchItemFailures`'s FIFO
rules, once one message in a `MessageGroupId` fails, every later message in that same group in the
batch must also be reported as failed, not just the one that errored.

- **KYC gating** (`docs/decisions/0003-kyc-gating.md`), rules the handler must keep:
  - The customer comes from the message attribute alone. A `customerId` in the body is never believed
    (a unit test pins this).
  - KYC status is read from the ledger's own table on every request, strongly consistent, and **never
    cached in the Lambda** — a revocation must count on the next request.
  - A rejection is an outcome: record it, announce it, acknowledge the message. Only a fault (a failed
    lookup, write or publish) fails the message so it is retried.
  - Announce from the record **on file**, not from the decision just made: a repeat of a key replays the
    original decision, even for a customer whose KYC has changed since.
  - The key is **per customer** (`docs/decisions/0004-customer-scoped-idempotency.md`): the table is keyed on
    the customer and the key, so another customer's request under the same string is decided on its own.
  - The KYC table is read-only to this Lambda (`infra` grants `GetItem` only). Do not add a write to it.

## Reading the key and the customer

`record.messageAttributes.IdempotencyKey.stringValue` and `…CustomerId.stringValue` (through `domain`'s
`extractIdempotencyKey` and `extractCustomerId`) — never parse either out of the message body. See the root
`AGENTS.md` gotchas for why (VTL parse error was the reason the key isn't in the body at all).
