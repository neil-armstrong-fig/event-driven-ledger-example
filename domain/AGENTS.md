# AGENTS.md — domain

Pure business logic: reading the idempotency key and customer id off a message, the KYC decision rule
(`evaluateKyc`), and the KYC event payload builders — see the root `AGENTS.md` package table. TDD here
means the test picks the shape, not the other way round — don't invent structure ahead of the first failing test.

## Source layout

Each folder's root holds its entry points and their tests; plain shapes drop into a `types/` folder
beneath. Folders are named for subject (root `AGENTS.md`, code style).

```
src/
├── message/                     reading an SQS message — from message attributes only, never the body
│   ├── ExtractIdempotencyKey.ts
│   ├── ExtractCustomerId.ts
│   └── types/IncomingLedgerMessage.ts
└── kyc/                         the KYC gate (docs/decisions/0003-kyc-gating.md)
    ├── EvaluateKyc.ts           status record + injected clock → passed, or rejected with a reason
    ├── ParseKycStatus.ts        a status read back from storage, or a fault — never a guess
    ├── ParseKycDecision.ts      a stored decision read back the same way
    ├── types/                   KycDecision, KycStatusRecord, StoredKycDecision
    └── events/                  BuildKycPassedEvent, BuildKycRejectedEvent
        └── types/               the two event details
```

`KycStatus`, `KycRejectionReason` and `KycOutcome` are **not** here: the acceptance specs use the same
words, so they are vocabulary in `shared/src/kyc/` (`as const` lists with the types read off them), and
this package imports them. The rules that pick between them stay here. The parsers exist because an
adapter reads plain strings back from storage; whether a string is a real status is pure, so it is tested
here and the adapter stays thin.

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
2. The KYC event payload builders (`KYC_PASSED`, `KYC_REJECTED`) — same red→green cycle, separately.
3. The KYC decision rule (`evaluateKyc`) — one case per row of the decision table in `docs/decisions/0003-kyc-gating.md`,
   the boundary included (the very moment of expiry counts as expired), with the clock passed in so nothing waits.

The named decisions in `docs/decisions/` are exactly the kind of edge case this package's tests should
encode explicitly — e.g. a test asserting that the idempotency key and the customer come from the message
attributes alone, and that a differing `requestId` or a `customerId` in the body has no effect on either.
Neither SQS dedup nor the DynamoDB conditional write exists in `domain`; those are `worker`/`infra`
concerns — this package proves only the pure shape the rest of the system relies on.

## Unit test convention (from root `AGENTS.md`, restated because it matters most here)

No wrapper `describe`. One file, one export, filename names it:
`BuildKycPassedEvent.ts` / `BuildKycPassedEvent.test.ts`, flat `it("...")` at the top level. Reach for
`describe` only when it says something the `it`s wouldn't otherwise each have to say.
