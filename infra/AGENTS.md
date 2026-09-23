# AGENTS.md — infra

The CDK app: stacks and constructs that deploy the worker's _built artifact_ — never imports its
source — see the root `AGENTS.md` package table. `src/` holds `LedgerStack.ts` (the real deployable
stack) plus one subject-named subfolder per resource (`queue/`, etc.), each with its test file
colocated right beside it — same convention as every other package, no separate `test/` folder. **No
`bin/` yet** (needed once a real `cdk synth`/`cdk deploy` CLI run is exercised, at Phase 4 step 7).
Built one resource at a time, 7 stops, each with the `LedgerStack` snapshot updated alongside the
construct code — see `docs/PLAN.md` Phase 4 for the exact resource order: (1) FIFO queue + FIFO DLQ,
(2) DynamoDB table, (3) EventBridge custom bus, (4) API GW + validator + direct SQS integration, (5)
worker Lambda + event source mapping, (6) least-privilege IAM, (7) full-stack `cdk synth` via the CLI.

## Import boundary

`eslint.config.js`: `allowedPackages: ["@ledger/shared"]` only. **Never import `@ledger/worker` or
`@ledger/domain` source** — deny-by-default means both are refused simply by being left out. Per the
root `AGENTS.md` package table, this package "deploys the worker's built artifact — never imports its
source." Exactly how that artifact gets built — `NodejsFunction`'s `entry` pointing at `worker`'s
source for esbuild to bundle, vs. some other build step — is a Phase 4 step 5 decision, not yet made;
don't assume the esbuild-bundles-source-directly shape until that step confirms it.

## THE local dev-loop gotcha — read before running anything against LocalStack

**Any redeploy onto an already-running LocalStack stack that includes API Gateway breaks the Stage —
silently.** `cdklocal deploy` reports success, CloudFormation shows `UPDATE_COMPLETE` on every
resource including the Stage, but `GetStages` returns empty and every request 404s with `"The API id
'...' does not correspond to a deployed API Gateway API"`. This reproduced during the Phase 1 spike for
both a validator addition **and** a pure Lambda-code-only change — it is not specific to one kind of
edit.

**The only reliable fix: `cdklocal destroy --force`, then a fresh `cdklocal deploy`.** Treat this as
the standard local iteration loop for this entire package, every time — never assume an incremental
update is safe to test against, even for a change that looks trivial. This does not affect CI (Phase
7's LocalStack container always starts fresh per run), only local manual/dev-loop testing.

## Other gotchas that apply specifically here

- **DynamoDB table needs `removalPolicy: RemovalPolicy.DESTROY`** set explicitly on the idempotency
  table. CDK's default is `RETAIN` (correct for production, wrong for this ephemeral demo stack) —
  forgetting this causes `ResourceInUseException: Table already exists` on the next fresh deploy after
  a teardown, and can leave the CloudFormation stack `DELETE_FAILED`.
- **Lambda runtime: `nodejs22.x` or newer.** `nodejs20.x` is already flagged deprecated by AWS.
- **`esbuild` must be a devDependency here** (wherever `NodejsFunction` is used) so CDK synth bundles
  without needing Docker. LocalStack's own Lambda _execution_ still needs the Docker socket mounted —
  that's separate and still required.
- **VTL request template for the API GW → SQS FIFO integration**: use the exact proven template from
  the Phase 1 spike (see `docs/PLAN.md` Phase 1 results, item 3) — `MessageBody` is an exact passthrough
  of the request body, `Idempotency-Key` goes in as `MessageAttribute.1.*`, never spliced into the JSON
  body. The message-attribute approach is a hard requirement, not a style choice — see the root
  `AGENTS.md` gotchas for the VTL parse error that ruled out body-splicing.
- **CDK output is tested by snapshot, not itemized assertions.** Neil's call: fine-grained
  `hasResourceProperties` checks per resource are too restrictive against ordinary TypeScript
  refactors — the goal is catching a _sneaky_ rename/property change a refactor introduced by
  accident, not pinning every property by hand. One `toMatchSnapshot()` of `Template.fromStack(new
LedgerStack(...)).toJSON()` — the real stack, not a per-construct test-only stack, since only the
  real stack's logical IDs reflect an actual accidental-replacement risk — does this: it fails with a
  reviewable diff on any resource addition/removal/rename/property change. Verified this actually
  catches a rename (not just a hypothetical): renaming a construct's mount id changes its
  CloudFormation logical ID hash, which shows up as a full resource replacement in the diff. Reach for
  a fine-grained assertion only when a specific property is important enough to deserve its own named
  failure message. Normalize Lambda asset hashes/`S3Key`s out of the serializer once a Lambda exists,
  or every snapshot diff trains people to blindly run `-u`. The `.snap` file must be committed —
  Vitest only fails on a _missing_ snapshot, so an uncommitted one gives zero protection.
- **LocalStack Hobby tier has no official CI support** — flagged as a risk to accept or work around at
  Phase 7, not this phase.
