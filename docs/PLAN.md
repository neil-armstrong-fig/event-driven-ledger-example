# Event-Driven Ledger — Interview Walking Skeleton — Plan

> This file is the single source of truth for this project. It's written to be resumable by any AI coding agent (Claude, Codex, etc.) or by Neil directly, cold, with no other context. If you're an agent picking this up: read this whole file before touching code, then read `TODO.md` for exactly where to resume.

## Context

This is interview prep. The interview will ask the candidate (Neil Armstrong, Software Architect) to diagram a system live, and the brief is "The Fractionalization Rush": a tokenized-asset ledger scenario chosen because it maps directly onto CV claims — event-driven AWS architecture, TypeScript expertise, AI-assisted 4x-velocity CDK/IaC generation, and a custom ATDD framework with a human-readable DSL. The goal is **not** a finished product; it's a small, rehearsable, structurally honest "walking skeleton" that can be talked through box-by-box, built the way it would actually be built (TDD/ATDD-first), with CDK's *output* under regression test — "I test my infrastructure, not just my code" is a specific, strong thing to say in an interview.

Neil is very familiar with CDK/AWS/Lambda/TypeScript already, so this plan doesn't over-explain those — it focuses on structure, sequencing, and the specific gaps/decisions that make this skeleton honest rather than hand-wavy.

### Original scenario brief (verbatim intent)

> Build a "Walking Skeleton" that proves event-driven physics:
> - **API Gateway & SQS**: API endpoint validates a basic JSON schema and pipes the payload directly into a FIFO SQS queue (`contentBasedDeduplication` enabled), returning 202 Accepted.
> - **Worker Lambda**: lightweight Node/TypeScript Lambda consuming SQS batches.
> - **DynamoDB idempotency**: `PutItem` with `ConditionExpression` (`attribute_not_exists(idempotencyKey)`) to mathematically guarantee zero double-spends.
> - **EventBridge emission**: on successful DB write, emit a `KYC_PASSED_STUB` event to a custom EventBridge bus, proving decoupling of downstream services.
> - **ATDD proof**: one highly readable integration test hitting API Gateway, waiting briefly, and asserting the DynamoDB record was created — demonstrating the custom ATDD framework/DSL.
> Aggressively scoped: no real Web3 logic, no third-party KYC integration.

### Structural template

Conventions adopted for this repo:
- pnpm workspace, **`AGENTS.md`-only** AI instructions — fractally scoped (root + one per package + one per subfolder once conventions accumulate). No `CLAUDE.md` needed; Claude Code and Codex both load `AGENTS.md` natively.
- ESLint-enforced import boundaries (`no-restricted-imports`, deny-by-default per package) instead of code-review-enforced ones.
- One export per file, named for its export, PascalCase.
- Folders named for subject, not shape (`idempotency/` not `helpers/`).
- ATDD in janggi's four layers (tests → acceptance-criteria-mapping → dsl → shared): each DSL object is a `*Dsl` (business vocabulary — Action/Question/Query naming) paired with a `*Client` in an `aws/` folder beside it (the mechanics). See `acceptance-tests/AGENTS.md`.
- Unit tests: **no wrapper `describe`** — flat `it(...)`, filename names the single export under test; nested `describe`s only for states that build on each other (see root `AGENTS.md`). Acceptance specs: nested `given`/`when`/`then` **is** the specification (opposite rule, deliberately).
- A hard CI gate (`pnpm checks` = lint+format+typecheck+unit) kept separate from slower/flakier non-gating workflows.
- "A passing test proves nothing until you've watched it fail" — mutation-testing-as-a-habit, written down as practice even without a dedicated tool.
- TypeScript pinned to **6.0.3** — TS7's new native compiler breaks `ts-node`'s (and other tools') programmatic API. Confirmed independently during this project's own spike (see below).

## Decisions made (confirmed with Neil)

- **Validation**: API Gateway native JSON-Schema request validator (no Lambda in the hot path before SQS). **Confirmed working on LocalStack** — see Phase 1 results.
- **Diagram**: Mermaid source committed under `docs/architecture.md`, doubles as documentation and interview rehearsal aid. Not yet written (Phase 8).
- **ATDD test target**: LocalStack, free "Hobby" tier (community edition was discontinued March 2026 — see Environment Setup below).
- **Idempotency key**: client-supplied `Idempotency-Key` HTTP header, decoupled from FIFO `MessageGroupId`. **Design changed during the spike**: it's carried as a native **SQS message attribute** (`IdempotencyKey`), not spliced into the JSON body — see Gotcha 2 below for why.
- **MessageGroupId**: per-`assetId` — realistic scaling story (parallel ordering per asset, confirmed working).
- **Domain logic**: separate `@ledger/domain` package (pure, zero AWS-SDK imports, boundary enforced by ESLint) — Neil explicitly chose the separate-package option over folding it into `worker/src/domain/`, a package per concern.
- **DynamoDB table removal policy**: `RemovalPolicy.DESTROY` (not CDK's default `RETAIN`) — this is an ephemeral demo/test stack, confirmed necessary during the spike (see Gotcha 3).
- **Lambda runtime**: use `nodejs22.x` or `nodejs24.x` in the real build — `nodejs20.x` (used in the throwaway spike) is already flagged deprecated by AWS as of April 2026.

## Two gaps named explicitly (raised during design review — confirm exact approach with Neil at Phase 5)

1. **Content-based dedup vs. the DynamoDB idempotency guard.** SQS FIFO `contentBasedDeduplication` silently drops a byte-identical duplicate message within its 5-minute window — before the `ConditionExpression` ever runs. The "zero double-spend" acceptance scenario must send two messages with the *same* `Idempotency-Key` header but a differing body field (a fresh `requestId`), so SQS treats them as distinct and the DynamoDB conditional write is what actually blocks the second one. **This has been proven working in the Phase 1 spike** (see below) — the design is validated, just needs the real implementation + acceptance test written this way.
2. **Dual-write gap (DynamoDB succeeds, EventBridge `PutEvents` fails).** On SQS redelivery, the conditional check then fails (idempotent by design) and the event never fires — a real gap an interviewer would probe. Cheapest in-scope fix: also emit the event on a `ConditionalCheckFailedException` (delivery becomes deliberately at-least-once, consumers must be idempotent) — and name DynamoDB-Streams-to-EventBridge-Pipes as the documented "outbox pattern" evolution path on the diagram, not built. **Decided (Neil, Phase 5 step 1): emit on `ConditionalCheckFailedException` too.** The outbox pattern stays a documented, unbuilt evolution path. Consequence for the double-spend acceptance spec: two same-key requests produce two events, so it asserts exactly one DynamoDB record and that every emitted event carries the same `idempotencyKey`, not "exactly one event".

## Environment setup (already done — don't redo)

- **Git**: repo initialized at `/home/neil/development/practice/event-driven-ledger`, default branch `main`. `.gitignore` committed first (excludes the CV file by exact name, `*:Zone.Identifier` WSL artifacts, `node_modules/`, `cdk.out/`, `.env`, etc.) — **verify this file still exists and covers the CV before adding anything else**.
- **LocalStack account**: Neil created a free Hobby-tier account and put `LOCALSTACK_AUTH_TOKEN=<token>` in a gitignored `.env` at the repo root. To use it: `set -a; source .env; set +a` (or equivalent) before any `docker run` that needs it. **Do not commit `.env`. Do not print the token to chat/logs.**
- **Docker**: works from this WSL2 distro (Docker Desktop WSL integration enabled by Neil mid-session). If a fresh session finds Docker unreachable again, that's a Neil-side fix (Docker Desktop → Settings → Resources → WSL Integration), not something to work around.
- **Tooling confirmed installed and working**: Node `v24.13.1`, pnpm `12.3.4` (no action needed), npm `11.8.0`. **No system-wide `aws` CLI, `awslocal`, `cdklocal`, or `pip3` available** — everything was done via `npx` (`aws-cdk`, `aws-cdk-local`) and the AWS SDK for JS directly (no Python tooling needed or used). `awslocal` **is** available *inside* the LocalStack container itself via `docker exec localstack-spike awslocal ...` if ever needed for quick inspection.

## Repo layout (target — not yet built beyond `.gitignore`)

```
event-driven-ledger/
├── AGENTS.md                      # root — fractal, one per package
├── .gitignore                     # DONE — CV file + *:Zone.Identifier + node_modules etc.
├── .env                           # DONE (gitignored) — LOCALSTACK_AUTH_TOKEN
├── package.json / pnpm-workspace.yaml
├── shared/          @ledger/shared        # event schemas, DTOs, JSON Schema for API GW validator model
├── domain/          @ledger/domain        # pure logic: idempotency semantics, event payload builder — zero AWS-SDK imports (ESLint-enforced)
├── worker/          @ledger/worker        # the SQS-batch Lambda handler; imports domain + shared, wraps AWS SDK calls
├── infra/           @ledger/infra         # CDK app, stacks, constructs; CDK-output tests live here
├── acceptance-tests/@ledger/acceptance-tests  # ATDD DSL + given/when/then specs against LocalStack
├── docs/
│   ├── PLAN.md                    # this file
│   ├── architecture.md            # Mermaid diagram + narrative — NOT YET WRITTEN (Phase 8)
│   └── decisions/                 # short ADRs for the two named gaps above, linked from code — NOT YET WRITTEN
└── .github/workflows/             # ci.yml (gating) — acceptance run against LocalStack service container — NOT YET WRITTEN
```

Import boundaries (ESLint `no-restricted-imports`, deny-by-default): `shared` → nothing; `domain` → `shared` only, **no `@aws-sdk/*`, no `aws-cdk-lib`**; `worker` → `domain` + `shared`; `infra` → `shared` only (never imports `domain`/`worker` source — it *deploys* the worker's built artifact); `acceptance-tests` → `shared` only; the AWS SDK and `fetch` are allowed only inside `aws/` folders, never in a `*Dsl` or a spec.

## Testing pyramid

| Layer | Tool | Lives in | Proves |
|---|---|---|---|
| Unit | Vitest | `domain/src/**/*.test.ts`, flat `it(...)`, no wrapper `describe` (nested `describe`s only where states build on each other) | idempotency-key handling, `KYC_PASSED_STUB` event payload shaping — pure functions |
| CDK output (regression) | Vitest + `aws-cdk-lib/assertions` | `infra/src/**/*.test.ts`, colocated with the construct/stack like every other package (no separate `test/` folder) | one `toMatchSnapshot()` of the synthesized `LedgerStack` template (Lambda asset hashes/`S3Key`s normalized out once a Lambda exists) — catches a resource rename/removal or property drift from a TypeScript refactor as a reviewable diff, without the brittleness of itemized `hasResourceProperties` checks. Reach for a fine-grained assertion only for one specific invariant that deserves its own named failure message, not as the default per resource |
| Acceptance (ATDD) | plain HTTP/AWS-SDK clients + custom DSL, run against LocalStack | `acceptance-tests/src/**` | the real event-driven physics end-to-end: 202 → SQS → Lambda → conditional DynamoDB write → EventBridge emission |

DSL shape: `dsl/ledger/LedgerDsl.ts` with members `requests`, `records`, `events` (business vocabulary only — `submit`, `waitForRecord`, `isRecorded`, `getKycPassedEventsFor`; Action/Question/Query naming), each paired with a `*Client` in an `aws/` folder beside it (actual `fetch`/AWS-SDK calls, real errors propagate raw). "Waits briefly" becomes an `eventually(poll, timeout)` helper used inside the clients, not a fixed `sleep`. EventBridge assertion needs a sink — a rule → SQS queue in the Phase 1 spike, replaced in Phase 6 by rule → Step Functions `PutItem` → DynamoDB table so specs can run in parallel (a shared queue is consumed by whoever reads it) — deployed only behind a CDK context flag so it never ships in a real deployment.

---

## Phase 1 — LocalStack spike: COMPLETE ✅ (all findings below are load-bearing for later phases)

Done in a throwaway scratch project (`/tmp/.../scratchpad/localstack-spike`, not part of this repo, already cleaned up — stack destroyed, container removed, no leftover AWS resources). All 6 planned integration checks passed. **These are not hypothetical risks anymore — they're proven facts about this exact environment.**

### Results

1. **LocalStack licensing (Sept 2026)**: Community edition was discontinued March 23 2026. Free "Hobby" tier requires account signup + `LOCALSTACK_AUTH_TOKEN`, non-commercial use only, no official CI support (acknowledge this when building Phase 7's CI — may need adjusting or accepting the risk). All needed services (`apigateway`, `sqs`, `dynamodb`, `events`, `lambda`) are available on this tier — confirmed via `/_localstack/health`, which also reported `"edition": "pro"` for this token (better than expected).
2. **SQS FIFO queue + FIFO DLQ**: deploys and verifies cleanly via `cdklocal deploy` + AWS SDK `GetQueueAttributesCommand`. No surprises.
3. **API Gateway → SQS FIFO direct integration**: works. Exact working VTL request template (this is the load-bearing artifact — copy this pattern into the real `infra` package):
   ```
   #set($assetId = $input.path('$.assetId'))
   #set($idempotencyKey = $input.params('Idempotency-Key'))
   Action=SendMessage&MessageGroupId=$util.urlEncode($assetId)&MessageBody=$util.urlEncode($input.body)&MessageAttribute.1.Name=IdempotencyKey&MessageAttribute.1.Value.DataType=String&MessageAttribute.1.Value.StringValue=$util.urlEncode($idempotencyKey)
   ```
   Integration response mapped to `202` with a small JSON body. IAM role for API Gateway needs `queue.grantSendMessages(role)`.
4. **JSON Schema request validator**: **is enforced** by LocalStack (confirmed 400 on a payload missing a required field, 202 on a valid one). The acceptance test can own this proof directly, as originally planned — no need to fall back to CDK-assertion-only proof.
5. **SQS FIFO → Lambda event source mapping**: works, delivers batches correctly. Confirmed Docker-socket access is required and works under this WSL2 setup (`-v /var/run/docker.sock:/var/run/docker.sock` on the LocalStack container). `NodejsFunction` bundled via **esbuild as a local devDependency** — no Docker needed for CDK synth/bundling itself (only LocalStack's own Lambda execution needs Docker).
6. **Custom EventBridge bus + `PutEvents`**: confirmed via the real target pattern the acceptance tests will use — an EventBridge rule (`event-pattern: {"detail-type": ["KYC_PASSED_STUB"]}`) targeting a temporary SQS queue, with an SQS queue policy granting `events.amazonaws.com` send permission. Event body received exactly as expected: `{"assetId":..., "idempotencyKey":...}` inside the standard EventBridge envelope.
7. **Double-spend scenario proven**: two SQS messages with the same `Idempotency-Key` message attribute but different `requestId` in the body both passed SQS content-based dedup (correctly, since bodies differ) — worker Lambda logs showed `Processed idem-003` then `Duplicate ignored: idem-003` in the same batch invocation, exactly one DynamoDB record resulted. **This validates Gap #1's design.**

### Bugs/gotchas found and fixed during the spike (all must carry into the real build)

- **TypeScript must be pinned to `6.0.3`** in every package (`ts-node`, and likely other tooling, breaks against TS7's new native compiler). Add `"typescript": "6.0.3"` as an exact-pinned devDependency everywhere.
- **Do not try to splice the `Idempotency-Key` header into the SQS `MessageBody` via VTL string concatenation.** AWS's VTL engine cannot cleanly handle escaped double-quotes inside a `$util.urlEncode("...")` argument (tested, fails with a VTL parse error). The fix — and the correct final design — is to keep `MessageBody` as an exact passthrough of the original request body, and carry `Idempotency-Key` as a **native SQS message attribute** instead (see the VTL template above). The worker Lambda reads it via `record.messageAttributes.IdempotencyKey.stringValue`, not from the parsed body.
- **DynamoDB tables default to `RemovalPolicy.RETAIN`** in CDK (this is correct real-AWS behavior, not a LocalStack quirk) — set `removalPolicy: RemovalPolicy.DESTROY` explicitly on the idempotency table in `infra`, since this is an ephemeral demo/test stack. Forgetting this causes `ResourceInUseException: Table already exists` on the next fresh deploy attempt after a stack teardown, and can leave CloudFormation stacks stuck in `DELETE_FAILED`.
- **Critical, general LocalStack limitation: any redeploy onto an already-running LocalStack stack that includes an API Gateway breaks the API Gateway Stage**, even for unrelated changes (confirmed this happens for a validator addition AND for a pure Lambda-code-only change). Symptom: `cdklocal deploy` reports success, CloudFormation shows the Stage resource as `UPDATE_COMPLETE`, but `GetStages` returns empty and every request 404s with `"The API id '...' does not correspond to a deployed API Gateway API"`. **The only reliable fix found is `cdklocal destroy --force` followed by a fresh `cdklocal deploy`.** This must be the standard local dev-loop workflow for this project whenever `infra` changes and involves API Gateway (which is almost always, since it's the walking skeleton's entry point) — document this loudly in `infra/AGENTS.md`. CI is unaffected since Phase 7's LocalStack container always starts fresh per run.
- Lambda `nodejs20.x` runtime already shows an AWS deprecation warning (deprecated 2026-04-30, creation disabled 2027-02-01) — use `nodejs22.x` or `nodejs24.x` in the real build.
- `tsconfig.json` needs `"types": ["node"]` explicitly (otherwise `__dirname`/`path` etc. fail to typecheck under `ts-node` even with `@types/node` installed) when the CDK app entry file uses Node built-ins directly (e.g. `NodejsFunction`'s `entry: path.join(__dirname, ...)`).

### Gotcha found after the spike, during Phase 2 (2026-09-23) — not from the LocalStack spike, but load-bearing the same way

- **Editing a pnpm workspace catalog version does not update `pnpm-lock.yaml` by itself.** `pnpm-workspace.yaml`'s `catalog:` is the single source of truth for a dependency's version, but the lockfile is a separate, independently-committed resolution of it — changing the catalog entry (e.g. dropping `prettier` from `3.9.9` to `3.9.6` to satisfy the `minimumReleaseAgeStrict` supply-chain policy, see Phase 2 step 3 above) leaves the lockfile still pointing at the old resolved version until it's explicitly regenerated. The mismatch doesn't surface until something re-verifies the lockfile against policy (`pnpm install`, `pnpm -r exec ...`, `pnpm checks`), which then fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` pointing at the *old*, already-rejected version — easy to misread as a new/regressed dependency problem rather than a stale lockfile. **Fix: `pnpm clean --lockfile` then `pnpm install`** — plain `pnpm install` alone does not self-heal, since it verifies the existing lockfile against policy before attempting any re-resolution. **Whenever a catalog version in `pnpm-workspace.yaml` changes, immediately regenerate the lockfile the same way** rather than assuming the next ordinary `pnpm install` will pick it up.

### Reusable code artifacts from the spike (reference these, don't necessarily copy verbatim — the spike app was minimal/throwaway, real `infra` package should follow full Phase 4 structure)

The spike's `bin/app.ts` (single-file, not the real package structure) and `src/handler.ts` demonstrated the full working shape: SQS FIFO queue + FIFO DLQ → API GW REST API with JSON Schema model + request validator + direct SQS integration (VTL above) → DynamoDB table (`PAY_PER_REQUEST`, `removalPolicy: DESTROY`) → EventBridge custom bus → `NodejsFunction` worker with `SqsEventSource` (`batchSize: 5`, `reportBatchItemFailures: true`) → least-privilege grants (`table.grantWriteData`, `bus.grantPutEventsTo`, `queue.grantSendMessages` on the API GW role). The handler does `PutItemCommand` with `ConditionExpression: "attribute_not_exists(idempotencyKey)"`, catches `ConditionalCheckFailedException` as an idempotent no-op (does **not** currently re-emit the event on this path — that's exactly Gap #2, to be decided at Phase 5), and on success emits `PutEventsCommand` with `DetailType: "KYC_PASSED_STUB"`. This whole shape is what Phase 4 (infra) and Phase 5 (worker) rebuild properly, resource-by-resource, with tests, in the real package structure — not a copy-paste of the throwaway file.

---

## Execution: fine-grained review gates (unchanged from original plan — Neil wants a STOP after every numbered step, no batching)

### Phase 1 — LocalStack spike: **COMPLETE ✅** (see results above)

### Phase 2 — Repo scaffold: **NEXT UP — see TODO.md**
1. `git init` — **DONE** (repo is on `main`, `.gitignore` committed as the first commit). No further action needed here.
2. pnpm workspace + 5 empty packages (`shared`, `domain`, `worker`, `infra`, `acceptance-tests`) + verify `.gitignore` still covers everything needed. **STOP.**
3. Shared tool config factories (`eslint.base.js`, `prettier.base.js`, `tsconfig.base.json` — **remember to pin `typescript: 6.0.3`** per the spike finding — `vitest.base.ts`) wired into each package, as factory functions (`baseConfig({tsconfigRootDir, allowedPackages})`). **STOP.**
4. Root + per-package `AGENTS.md` (ATDD-first workflow, no-`describe` unit rule, import boundaries, one-export-per-file, "read AGENTS.md on your path before editing", **plus the LocalStack destroy-before-redeploy gotcha documented in `infra/AGENTS.md`**). Neil reviews the actual rule text, not just that the files exist. **STOP.**

### Phase 3 — `domain` package, TDD
1. Failing unit tests for idempotency-key handling (header/message-attribute extraction/shape) — shown red before any implementation. **STOP.**
2. Implementation to green + Neil's review of the two-gap scenario semantics baked into these tests. **STOP.**
3. Same red→green cycle for the `KYC_PASSED_STUB` event payload builder. **STOP.**

### Phase 4 — `infra` package, one CDK resource at a time, tests alongside each
Each of these is its own stop, with the `LedgerStack` snapshot updated alongside the construct code: (1) FIFO queue + FIFO DLQ, (2) DynamoDB table (remember `removalPolicy: DESTROY`), (3) EventBridge custom bus, (4) API GW REST API + validator + direct SQS integration (use the proven VTL template from Phase 1, **with the message-attribute approach, not body-splicing**), (5) worker Lambda (`NodejsFunction`, `runtime: NODEJS_22_X` or newer, esbuild devDependency) + event source mapping with `reportBatchItemFailures: true`, (6) least-privilege IAM wiring across all of the above. **7 stops total, one per item plus a final step 7 that actually runs `cdk synth`/`cdklocal synth` via the CLI** — a different kind of check than the per-step Vitest snapshot: the snapshot catches unexpected drift from a refactor (a rename, a dropped property), CLI synth catches things only the real synthesis path can (an unbundled `NodejsFunction` entry, a CDK context/bootstrap issue, anything the in-process `Template.fromStack()` path used by the tests doesn't exercise). Remember: local dev-loop testing against LocalStack means `destroy` then fresh `deploy` every time, not incremental updates (see Phase 1 gotcha).

### Phase 5 — `worker` package, TDD — confirms the two named gaps with Neil first
1. Confirm with Neil: dual-write approach for Gap #2 (emit-on-`ConditionalCheckFailedException` vs. documented-but-unbuilt outbox) and the exact double-spend test scenario shape for Gap #1 (**already proven working in the spike** — same `Idempotency-Key` message attribute, differing `requestId` body field). **STOP — decision, not code.**
2. Failing tests for the batch handler per that decision, shown red. **STOP.**
3. Implementation to green, including FIFO partial-batch-failure semantics (fail every later message in the same group once one fails, per `reportBatchItemFailures` FIFO rules). **STOP.**

### Phase 6 — `acceptance-tests` package
1. The `*Client` wrappers (real SDK/fetch calls) + `eventually()` poller — reviewed before the DSL is built on top. **STOP.**
2. `dsl/ledger/` — the `*Dsl` business-vocabulary layer over them, plus the acceptance-criteria-mapping. **STOP.**
3. Happy-path given/when/then spec, run red against a deployed LocalStack stack, then green. **STOP.**
4. Double-spend given/when/then spec (same `Idempotency-Key`, differing body field — exactly one record, exactly one event), red then green — **the exact scenario already proven manually in Phase 1**, now automated. **STOP.**
5. EventBridge sink-under-context-flag reviewed to confirm it never ships in a real deployment — **use the proven rule+SQS-target pattern from Phase 1**. **STOP.**

### Phase 7 — CI
1. `ci.yml` gate job (lint/format/typecheck/domain unit tests/CDK assertion+snapshot tests). **STOP.**
2. `acceptance-tests` job with LocalStack service container (Docker socket mounted, `LOCALSTACK_AUTH_TOKEN` from a GitHub Actions secret — **remember the free Hobby tier has no official CI support**, decide/accept this risk here), gated on step 1 passing. **STOP.**

### Phase 8 — `docs/architecture.md`
1. Mermaid diagram draft (client → API GW+validator → SQS FIFO → worker Lambda → DynamoDB conditional write → EventBridge bus → [stubbed downstream]) — reviewed for interview-rehearsal accuracy before prose is added. **STOP.**
2. Prose per box + the two ADRs for the dedup/dual-write decisions, linked from the source lines they justify. **STOP.**

## Verification (once built)

- `pnpm checks` green (lint + format + typecheck + domain unit tests + CDK assertion/snapshot tests) — the CI gate, runnable locally at any phase from Phase 2 onward.
- `pnpm acceptance-tests` deploys fresh to LocalStack and runs the given/when/then specs, including the double-spend scenario asserting exactly one DynamoDB record and exactly one EventBridge event for two distinct-but-same-key requests.
- Manual walkthrough: `curl` the deployed LocalStack API Gateway endpoint directly, confirm 202, then inspect the DynamoDB table and EventBridge sink table via the AWS SDK (or `docker exec <container> awslocal ...`) to see the record and event by hand — useful as an interview demo script, not just an automated check.
