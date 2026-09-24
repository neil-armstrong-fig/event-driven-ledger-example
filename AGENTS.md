# event-driven-ledger — AI instructions

This file governs how any AI agent (Claude, Codex, or otherwise) works in this repo. Read it in full before touching code. If you're resuming cold, also read `README.md` (what this is and how it fits together) and `docs/architecture.md` (the diagram, a paragraph per box, and how it is tested) — this file is about *how* to work, those are about *what* and *why*.

## Git — hard rule

**Never run `git add`, `git commit`, `git push`, or any command that stages/commits/pushes.** The developer commits everything, always. This applies even if a task seems to naturally end with "and commit it" — it doesn't, here. Leave changes unstaged and tell the developer what changed; they decide when and how to commit. The one exception already made: `git init` and the very first `.gitignore` commit, done with the developer's explicit real-time approval in chat — that precedent does not extend to anything else.

The developer stages files while reviewing them, so `git status` will show files randomly staged while work is in progress. That is not a signal of anything — treat everything as unstaged and don't flag it.

Also never: create/switch/delete branches, force-push, `git reset --hard`, or any other history-rewriting or remote-affecting operation, without being asked in that specific instance.

## Package table

| Package | Purpose | May import |
|---|---|---|
| `shared` | Event schemas, DTOs, JSON Schema for the API GW validator model, and the vocabulary the acceptance tests share with the code (KYC statuses and reasons). Bottom of the dependency graph. | nothing else in the workspace |
| `domain` | Pure business logic: idempotency-key and customer-id extraction, the KYC decision rule, KYC event payload construction. Zero AWS imports. | `shared` only |
| `worker` | The SQS-batch Lambda handler. Wires `domain` logic to real AWS SDK calls. | `domain`, `shared` |
| `infra` | CDK app, stacks, constructs. Deploys the worker's *built artifact* — never imports its source. CDK-output regression tests live here. | `shared` only |
| `acceptance-tests` | ATDD DSL + given/when/then specs, run against a deployed LocalStack stack. | `shared`, plus the AWS SDK inside its own `aws/` folders only |

Import boundaries are enforced by ESLint `no-restricted-imports`, deny-by-default (a new workspace package is denied until explicitly added to `allowedPackages`). This is not a convention to remember and follow by hand — it's a lint failure if violated, so trust `pnpm checks` over memory.

`docs/` holds only research or decisions that would otherwise need to be re-derived — see `docs/architecture.md` for the project's full context and `docs/decisions/` for the three ADRs (dedup-vs-idempotency, dual-write, KYC gating). Link code back to the doc section it implements(e.g. a comment naming the `docs/` section a rule comes from).

## Before changing code

1. Read every `AGENTS.md` on the path to the file you're touching — root, then package, then any nested one.
2. Read `docs/architecture.md` and the relevant `docs/decisions/` ADR to confirm what the system is meant to do and why. Work one step at a time and show the result before moving on — do not batch unrelated changes into one turn of work, regardless of which tool is driving.
3. Inspect the nearest existing implementation or test for local convention. If there isn't one yet, say so explicitly rather than inventing a convention silently.
4. State which instruction files and reference implementations you used before editing.
5. Before calling anything finished, re-read the relevant `AGENTS.md` and do a standards-only pass over your own diff — catch what lint/tests can't.

## How work is done here — TDD/ATDD, not just as a slogan

- **Acceptance-test-first**: for any user-observable behaviour, write the given/when/then spec before the implementation, watch it fail for the *right* reason (not a typo, not a missing import — the actual behaviour under test), then make it pass.
- **Unit-test-first** for pure logic in `domain`: red, then green, then move on. Don't write the implementation first and backfill tests.
- **A passing test proves nothing until you've watched it fail.** For any test you didn't just write red-then-green yourself (inherited, retrofitted, or written by another agent), deliberately break the code it covers, run it, confirm it fails for the right reason, then restore. This is a required verification step, not an optional audit. Confirm the mutation actually applied (`cmp` or `grep` the file — Prettier can reflow one away and give a false green), and note *which* tests fell: the wrong ones, or too many, means the cover is in the wrong place. Cover what was **written**, not only that something was: mutating a stored field (the KYC status, the timestamp) slipped past every acceptance spec until one read it back.
- **CDK output is tested too**, not just application code — see "How it is tested" in `docs/architecture.md`. A CDK snapshot test with an unnormalised Lambda asset hash trains people to blindly run `-u`; normalise asset hashes/`S3Key`s out of the serialiser so snapshot diffs stay meaningful.

## Unit test convention

No wrapper `describe` in unit test files — the filename already names the single export under test (e.g. `BuildKycPassedEvent.ts` / `BuildKycPassedEvent.test.ts`), so a plain function gets flat `it("...")` sentences at the top level.

Reach for nested `describe`s when the subject has states that build on each other — a scenario that starts from a state, then a further event on top of it, then another. Each level's name says the state or event ("a ledger with nothing recorded" → "when two requests share an idempotency key…"), a `beforeEach` narrows it (arrange, or arrange and act), and each `it` makes one assertion about the outcome. Read top to bottom it tells the story of the behaviour and shows how each layer builds on the last, which is worth more than a flat list when the cases share setup. The test is the same either way; the question is whether a `describe` name says something the `it`s would otherwise each have to repeat, and a `describe` with nothing in `beforeEach` is just a filing cabinet — don't.

**Acceptance specs are the opposite, deliberately**: nested `given`/`when`/`then` *is* the specification, not a wrapper to avoid.

## Code style (beyond what Prettier/ESLint enforce automatically)

- One concept per file, PascalCase and named for it. A const list and the type read off it are one concept and share a file (`KYC_STATUSES` and `KycStatus`); nothing else does.
- A union of literals is a list plus a derived type: declare it `as const` and read the type off it (`(typeof X)[number]`), so the two cannot drift. A union with no runtime list to keep it honest stays a plain `type`.
- Declare functions below their callers — top-down reading order.
- No ternaries unless an expression is genuinely required. Use an `if` that returns early — the short circuit — and let the fall-through be the other case; if that needs a value, extract a small function. Not lint-enforced, so check your own diff for `?` … `:`.
- Extract pure logic into `domain` when it's cheaply testable there; otherwise keep it inline rather than creating a premature abstraction.
- A file lives as close to its caller as it can, in a subdirectory of it: a helper or type used by one file goes in a folder beneath it, never beside it. Something shared rises to its callers' nearest common ancestor and no further.
- A folder's root is its table of contents: the entry points sit at the top and everything else drops into a subfolder. About six files is where a folder starts reading as a bucket — a smell, not a hard limit.
- Name folders for subject, not shape (`idempotency/`, not `helpers/` or `utils/`). The one shape name in use is `types/`, for a folder's plain shapes (`worker/src/batch/types/`, `domain/src/kyc/types/`).
- Words the acceptance specs and the code must agree on (statuses, reasons, event names) are vocabulary and live in `shared`; the rules that use them stay in `domain`. A spec that spelled a status differently from the code would compile, run and quietly never match.
- Every type gets a name — no inline object/union types except a function's own narrow parameter-object type.
- `interface` for object shapes, not `type` — `type` is for unions/primitive aliases/anything `interface` can't express. Enforced by ESLint (`@typescript-eslint/consistent-type-definitions`).
- Max 3 positional parameters, otherwise a named options object.
- Explicit function return types; `import type` for type-only imports.
- Prefer named `export function` over `export default`.
- No `../` relative-import climbing — use the package's path alias once one exists.
- British spelling in prose (comments, docs, this file); American spelling in code itself (identifiers, file names, string literals such as test titles, the API path), because SDKs and libraries are American English. Established terms such as pnpm's `catalog` keep their own spelling.

## Reference implementation

<https://github.com/neil-armstrong-fig/janggi> (open source) is the developer's fuller example of these code standards (a pnpm workspace with the same one-export-per-file, ESLint-enforced boundaries, DSL-based acceptance tests, and per-package `AGENTS.md` conventions). When a convention here is unclear or not yet demonstrated in this repo, read the equivalent there — for nested-`describe` unit tests, its webapp unit tests (e.g. `webapp/src/redux/ratings/RatingsSlice.test.ts`), not its acceptance tests. It's a reference to read, not code to copy: this repo's own `AGENTS.md` files win on any conflict.

## Ask before

- Adding or upgrading any dependency.
  - Once approved, every `pnpm-workspace.yaml` catalog entry needs a one-line comment directly above it saying why it's there (its role, plus the reason for any non-latest pin). Write the comment in the same edit as the entry, update it whenever the entry's purpose or pin rationale changes, and delete it with the entry — a stale comment is worse than none.
  - `pnpm add --save-catalog` writes a caret range and a single-quoted key; change them to an exact pin and a double-quoted key to match the rest of the catalog, then update the lockfile in place with `pnpm install --lockfile-only` (an in-place update, not a from-scratch rebuild).
- Deleting or rebuilding a lockfile.
- Any destructive git operation (see the hard rule above — but also branch creation, stash, checkout of someone else's uncommitted work).
- Deploying to a real (non-LocalStack) AWS account.
- Anything beyond what was asked — when in doubt about scope, stop and ask rather than extending the current step.

## Local dev-loop gotcha — read this before touching `infra`

**Any redeploy onto an already-running LocalStack stack that includes API Gateway breaks the Stage**, even for a change as small as editing the Lambda handler's code, with no error — `cdklocal deploy` reports success, CloudFormation shows `UPDATE_COMPLETE`, but every request 404s afterward. The only reliable fix is a full `cdklocal destroy --force` followed by a fresh `cdklocal deploy`. Treat this as the standard local iteration loop for `infra` — never assume an incremental update is safe to test against. CI is unaffected since it always starts from a fresh LocalStack container.

## Other confirmed gotchas (proven against LocalStack during the initial spike)

- `typescript` is pinned to exactly `6.0.3` in every package — TS7's new native compiler breaks `ts-node`'s programmatic API.
- `Idempotency-Key` travels as a native **SQS message attribute**, never spliced into the JSON message body via VTL string concatenation — that approach was tried and fails with a VTL parse error.
- `CustomerId` travels the same way, from the `Customer-Id` header — the one seam a real authoriser replaces (`docs/decisions/0003-kyc-gating.md`). Never read a customer from the body.
- A failed `attribute_not_exists` put hands back the original item when asked (`ReturnValuesOnConditionCheckFailure: "ALL_OLD"`, then `error.Item`) — proven on LocalStack, so no second read is needed.
- DynamoDB's idempotency table needs `removalPolicy: RemovalPolicy.DESTROY` set explicitly — CDK's default is `RETAIN`, which is correct for production but breaks fresh redeploys of this ephemeral demo stack.
- Lambda runtime: use `nodejs22.x` or newer — `nodejs20.x` is already flagged deprecated.
- `esbuild` must be a devDependency wherever `NodejsFunction` is used, so CDK synth bundles without needing Docker (LocalStack's own Lambda *execution* still needs the Docker socket mounted — that's a separate, required thing).
- `LOCALSTACK_AUTH_TOKEN` lives in a gitignored `.env` at the repo root — load it (`set -a; source .env; set +a`) before any command that talks to LocalStack. Never print it or commit it.

## Where lessons go

When the developer gives a correction or preference worth keeping, write it into the relevant `AGENTS.md` (root for repo-wide, package-level for package-specific), not into an agent's private memory — other agents (Codex, etc.) can't read that, and this file is the shared source of truth.

## Keeping context small

Read only the part of a file you need. Don't `cat` an `AGENTS.md` already loaded into context this session. Keep this file itself lean — when a convention is superseded, remove the old text rather than layering a correction on top.
