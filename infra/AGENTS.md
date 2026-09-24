# AGENTS.md — infra

The CDK app: stacks and constructs that deploy the worker's _built artifact_ — never imports its
source — see the root `AGENTS.md` package table. `src/` holds `LedgerStack.ts` (the real deployable
stack) plus one subject-named subfolder per resource (`queue/`, etc.), each with its test file
colocated right beside it — same convention as every other package, no separate `test/` folder. `bin/App.ts` is the CDK CLI entry (`cdk.json` runs it via `tsx`); `pnpm synth` runs a real `cdk synth`, outside `checks`. `pnpm deploy:local` is `cdklocal destroy --force` then a fresh `cdklocal deploy` with `-c includeEventSink=true` — the destroy-first loop below, as one command (needs LocalStack up and bootstrapped).
Built one resource at a time, each with the `LedgerStack` snapshot updated alongside the construct code: FIFO queue + DLQ, DynamoDB idempotency table, KYC status table, EventBridge bus, API GW + validator + direct SQS integration, worker Lambda + event source mapping, least-privilege IAM, and a full-stack `cdk synth` via the CLI.

## Source layout

The `src/` root is the table of contents: the stack, its test and snapshot, then one subfolder per
resource, named for its subject. A helper used by one construct sits in a folder beneath it, never
beside it. Imports use the `@src/*` alias, never `./` or `../`.

```
src/
├── LedgerStack.ts                    the deployable stack — mounts every construct below
├── LedgerStack.test.ts               two whole-stack snapshots — production and acceptance-test (`includeEventSink`) — asset hashes normalised, plus the sink gate and the outputs contract
├── __snapshots__/
├── queue/LedgerRequestQueue.ts       FIFO queue + FIFO DLQ
├── idempotency/                      DynamoDB idempotency table
│   ├── LedgerIdempotencyTable.ts
│   └── LedgerIdempotencyTable.test.ts   DESTROY removal policy (own named assertion)
├── kyc/                              DynamoDB KYC status table, keyed on the customer — the worker only reads it
│   ├── LedgerKycTable.ts
│   └── LedgerKycTable.test.ts        DESTROY removal policy, and the customer key (own named assertions)
├── events/                           EventBridge
│   ├── LedgerEventBus.ts             custom bus
│   └── LedgerEventSink.ts            rule (both KYC events) → state machine → table of events for acceptance tests; only with `-c includeEventSink=true`
├── api/                              API Gateway → SQS
│   ├── LedgerApi.ts
│   ├── LedgerApi.test.ts             Idempotency-Key and Customer-Id headers are required
│   └── request/LedgerApiRequestTemplate.ts   the VTL request template — and the one seam for identity
└── worker/                           worker Lambda + SQS event source + grants
    ├── LedgerWorker.ts
    └── workspace/FindWorkspaceRoot.ts        locates the worker entry file from the repo root
```

## Import boundary

`eslint.config.js`: `allowedPackages: ["@ledger/shared"]` only. **Never import `@ledger/worker` or
`@ledger/domain` source** — deny-by-default means both are refused simply by being left out. Per the
root `AGENTS.md` package table, this package "deploys the worker's built artifact — never imports its
source." `NodejsFunction`'s `entry` points at a `worker/src/` file by path
(never a TypeScript import) and esbuild bundles it at synth. Because `Template.fromStack` in the
snapshot test synthesises for real, a worker that can't be found or bundled fails `pnpm checks` (and so
the CI gate) — verified with a missing `entry`. esbuild doesn't type-check; `worker`'s own `type-check`
does.

## `bin/App.ts` only creates the App and the stacks

It is the CDK CLI entry, so it stays as close to empty as possible: `import {App} from "aws-cdk-lib"`,
`const app = new App()`, and one `new XStack(app, "XStack")` per stack. No config, env vars, tags,
conditionals or calls — every decision lives inside a stack, where the snapshot test can see it, and
`bin/` is not covered by tests. Need a value in there? Give the stack a prop or put the logic in the
stack. This is enforced by an override in `eslint.config.js`, not left to memory: imports are denied
by default (only `App` from `aws-cdk-lib` and `@src/*Stack` are re-allowed — never other `@src/*`
files, `aws-cdk-lib` subpaths or relative paths), only imports/`const`/expression statements are
allowed at the top level, calls/conditionals/logical expressions and `process.env` are banned, and
`max-lines` is 15. If lint blocks a change here, move the code into a stack rather than loosening
the rule.

## THE local dev-loop gotcha — read before running anything against LocalStack

**Any redeploy onto an already-running LocalStack stack that includes API Gateway breaks the Stage —
silently.** `cdklocal deploy` reports success, CloudFormation shows `UPDATE_COMPLETE` on every
resource including the Stage, but `GetStages` returns empty and every request 404s with `"The API id
'...' does not correspond to a deployed API Gateway API"`. This reproduced for
both a validator addition **and** a pure Lambda-code-only change — it is not specific to one kind of
edit.

**The only reliable fix: `cdklocal destroy --force`, then a fresh `cdklocal deploy`.** Treat this as
the standard local iteration loop for this entire package, every time — never assume an incremental
update is safe to test against, even for a change that looks trivial. This does not affect CI (Phase
7's LocalStack container always starts fresh per run), only local manual/dev-loop testing.

## Other gotchas that apply specifically here

- **Every DynamoDB table needs `removalPolicy: RemovalPolicy.DESTROY`** set explicitly (idempotency, KYC
  status, and the sink). CDK's default is `RETAIN` (correct for production, wrong for this ephemeral demo stack) —
  forgetting this causes `ResourceInUseException: Table already exists` on the next fresh deploy after
  a teardown, and can leave the CloudFormation stack `DELETE_FAILED`.
- **Lambda runtime: `nodejs22.x` or newer.** `nodejs20.x` is already flagged deprecated by AWS.
- **`esbuild` must be a devDependency here** (wherever `NodejsFunction` is used) so CDK synth bundles
  without needing Docker. LocalStack's own Lambda _execution_ still needs the Docker socket mounted —
  that's separate and still required.
- **VTL request template for the API GW → SQS FIFO integration**: use the proven template in
  `src/api/request/LedgerApiRequestTemplate.ts` — `MessageBody` is an exact passthrough
  of the request body, `Idempotency-Key` goes in as `MessageAttribute.1.*` and `Customer-Id` as
  `MessageAttribute.2.*`, never spliced into the JSON body. `Customer-Id` stands in for what an authoriser
  would supply: with real auth, `$context.authorizer.principalId` replaces that one expression. The message-attribute approach is a hard requirement, not a style choice — see the root
  `AGENTS.md` gotchas for the VTL parse error that ruled out body-splicing.
- **CDK output is tested by snapshot, not itemised assertions.** The developer's call: fine-grained
  `hasResourceProperties` checks per resource are too restrictive against ordinary TypeScript
  refactors — the goal is catching a _sneaky_ rename/property change a refactor introduced by
  accident, not pinning every property by hand. One `toMatchSnapshot()` of `Template.fromStack(new
LedgerStack(...)).toJSON()` — the real stack, not a per-construct test-only stack, since only the
  real stack's logical IDs reflect an actual accidental-replacement risk — does this: it fails with a
  reviewable diff on any resource addition/removal/rename/property change. Verified this actually
  catches a rename (not just a hypothetical): renaming a construct's mount id changes its
  CloudFormation logical ID hash, which shows up as a full resource replacement in the diff. Reach for
  a fine-grained assertion only when a specific property is important enough to deserve its own named
  failure message. The Lambda asset `S3Key` hash is normalised out in `LedgerStack.test.ts`,
  so a worker code change doesn't churn the snapshot and train people to blindly run `-u`. The `.snap` file must be committed —
  Vitest only fails on a _missing_ snapshot, so an uncommitted one gives zero protection.
- **The worker is least-privilege per table**: `PutItem` on the idempotency table, `GetItem` on the KYC
  table, and never a write to the KYC table — a worker that could write it could make a customer verified
  (`docs/decisions/0003-kyc-gating.md`). Only the snapshot pins this, so read that diff line by line.
- **The sink stores an event's whole `detail` as one JSON string** (`States.JsonToString`, accepted by
  LocalStack), not field by field: a JSON path missing from an event fails the state, and the two KYC
  events carry different fields (only a rejection has a `reason`).
- **LocalStack Hobby tier has no official CI support** — the CI `acceptance` job can fail for licensing
  or service reasons unrelated to the code — a risk accepted knowingly.
