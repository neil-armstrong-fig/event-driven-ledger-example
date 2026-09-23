# AGENTS.md — domain

Pure business logic: idempotency-key semantics and the `KYC_PASSED_STUB` event payload builder — see
the root `AGENTS.md` package table. TDD here means the test picks the shape, not the other way round — don't invent structure ahead of the first failing test.

## Import boundary — stricter than the workspace rule

`eslint.config.js` enforces two things, not just one:

1. The usual workspace boundary: `allowedPackages: ["@ledger/shared"]` — nothing else in the
   `@ledger/*` scope.
2. **Zero AWS imports, named explicitly**: `aws-cdk-lib`, `constructs`, `aws-sdk`, `aws-lambda`, plus
   the `@aws-sdk/*`, `aws-cdk-lib/**`, `@aws-cdk/*`, `@aws-lambda-powertools/*` patterns are all
   banned by `no-restricted-imports`, independent of the workspace-package check. This is the one
   package in the workspace where an import boundary is enforced on _external_ packages, not just
   internal ones — because the whole point of `domain` is that idempotency-key handling and event
   shaping are provable with zero AWS resources running. If a test here needs a mock SQS record or
   DynamoDB item shape, define that shape's _fields_ locally (or in `shared`) rather than importing an
   AWS SDK type for it.

## TDD — this package is where "unit-test-first" is not optional

Per the root `AGENTS.md`: red, then green, then move on. Concretely:

1. Idempotency-key handling — write the failing test for header/message-attribute extraction and
   shape first, watch it fail for the right reason, show it to the developer before implementing.
2. `KYC_PASSED_STUB` event payload builder — same red→green cycle, separately.

The two named gaps in `docs/decisions/` (dedup-vs-idempotency, dual-write) are exactly the kind of edge
case this package's tests should encode explicitly — e.g. a test asserting that the idempotency key
comes from the message attribute alone, and a differing `requestId` in the body has no effect on it.
Neither SQS dedup nor the DynamoDB conditional write exists in `domain`; those are `worker`/`infra`
concerns — this package proves only the pure shape the rest of the system relies on.

## Unit test convention (from root `AGENTS.md`, restated because it matters most here)

No wrapper `describe`. One file, one export, filename names it:
`BuildKycPassedEvent.ts` / `BuildKycPassedEvent.test.ts`, flat `it("...")` at the top level. Reach for
`describe` only when it says something the `it`s wouldn't otherwise each have to say.
