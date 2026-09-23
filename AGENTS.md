# event-driven-ledger — AI instructions

This file governs how any AI agent (Claude, Codex, or otherwise) works in this repo. Read it in full before touching code. If you're resuming cold, also read `docs/PLAN.md` (full project context and decisions) and `TODO.md` (exact current status and next action) — this file is about *how* to work, those are about *what* to build and *why*.

## Git — hard rule

**Never run `git add`, `git commit`, `git push`, or any command that stages/commits/pushes.** Neil commits everything himself, always. This applies even if a task seems to naturally end with "and commit it" — it doesn't, here. Leave changes unstaged and tell him what changed; he decides when and how to commit. The one exception already made: `git init` and the very first `.gitignore` commit, done with his explicit real-time approval in chat — that precedent does not extend to anything else.

Also never: create/switch/delete branches, force-push, `git reset --hard`, or any other history-rewriting or remote-affecting operation, without being asked in that specific instance.

## Package table (target structure — see `docs/PLAN.md` for build status)

| Package | Purpose | May import |
|---|---|---|
| `shared` | Event schemas, DTOs, JSON Schema for the API GW validator model. Bottom of the dependency graph. | nothing else in the workspace |
| `domain` | Pure business logic: idempotency-key semantics, `KYC_PASSED_STUB` event payload construction. Zero AWS imports. | `shared` only |
| `worker` | The SQS-batch Lambda handler. Wires `domain` logic to real AWS SDK calls. | `domain`, `shared` |
| `infra` | CDK app, stacks, constructs. Deploys the worker's *built artifact* — never imports its source. CDK-output regression tests live here. | `shared` only |
| `acceptance-tests` | ATDD DSL + given/when/then specs, run against a deployed LocalStack stack. | `shared`, plus its own `aws/*Client.ts` wrappers |

Import boundaries are enforced by ESLint `no-restricted-imports`, deny-by-default (a new workspace package is denied until explicitly added to `allowedPackages` — same mechanism as janggi's `shared/config/eslint.base.js`). This is not a convention to remember and follow by hand — it's a lint failure if violated, so trust `pnpm checks` over memory.

`docs/` holds only research or decisions that would otherwise need to be re-derived — see `docs/PLAN.md` for the project's full context and `docs/decisions/` (once written, Phase 8) for the two named architectural gaps (dedup-vs-idempotency, dual-write). Link code back to the doc section it implements, the way janggi's `IsBikjang.ts` cites `docs/rules.md §6.2`.

## Before changing code

1. Read every `AGENTS.md` on the path to the file you're touching — root, then package, then any nested one.
2. Read `docs/PLAN.md` and `TODO.md` to confirm what phase/step you're actually on. This project is being built in explicit, numbered, stop-after-each-step phases at Neil's request — do not skip ahead or batch multiple steps into one turn of work, regardless of which tool is driving.
3. Inspect the nearest existing implementation or test for local convention. If there isn't one yet (early phases), say so explicitly rather than inventing a convention silently.
4. State which instruction files and reference implementations you used before editing.
5. Before calling anything finished, re-read the relevant `AGENTS.md` and do a standards-only pass over your own diff — catch what lint/tests can't.

## How work is done here — TDD/ATDD, not just as a slogan

- **Acceptance-test-first**: for any user-observable behavior, write the given/when/then spec before the implementation, watch it fail for the *right* reason (not a typo, not a missing import — the actual behavior under test), then make it pass.
- **Unit-test-first** for pure logic in `domain`: red, then green, then move on. Don't write the implementation first and backfill tests.
- **A passing test proves nothing until you've watched it fail.** For any test you didn't just write red-then-green yourself (inherited, retrofitted, or written by another agent), deliberately break the code it covers, run it, confirm it fails for the right reason, then restore. This is a required verification step, not an optional audit.
- **CDK output is tested too**, not just application code — see Testing pyramid in `docs/PLAN.md`. A CDK snapshot test with an unnormalized Lambda asset hash trains people to blindly run `-u`; normalize asset hashes/`S3Key`s out of the serializer so snapshot diffs stay meaningful.

## Unit test convention

No wrapper `describe` in unit test files — the filename already names the single export under test (e.g. `BuildKycPassedEvent.ts` / `BuildKycPassedEvent.test.ts`), so write flat `it("...")` sentences at the top level. Reach for `describe` only when it says something the `it`s wouldn't otherwise each have to say (a narrowing `beforeEach`, genuinely different setups).

**Acceptance specs are the opposite, deliberately**: nested `given`/`when`/`then` *is* the specification, not a wrapper to avoid.

## Code style (beyond what Prettier/ESLint enforce automatically)

- One export per file, named for its export, PascalCase for the file.
- Declare functions below their callers — top-down reading order.
- Extract pure logic into `domain` when it's cheaply testable there; otherwise keep it inline rather than creating a premature abstraction.
- A file lives as close to its caller as possible, rising only to the nearest common ancestor.
- Name folders for subject, not shape (`idempotency/`, not `helpers/` or `utils/`).
- Every type gets a name — no inline object/union types except a function's own narrow parameter-object type.
- `interface` for object shapes, not `type` — `type` is for unions/primitive aliases/anything `interface` can't express. Enforced by ESLint (`@typescript-eslint/consistent-type-definitions`).
- Max 3 positional parameters, otherwise a named options object.
- Explicit function return types; `import type` for type-only imports.
- Prefer named `export function` over `export default`.
- No `../` relative-import climbing — use the package's path alias once one exists.

## Ask before

- Adding or upgrading any dependency.
  - Once approved, every `pnpm-workspace.yaml` catalog entry needs a one-line comment directly above it saying why it's there (its role, plus the reason for any non-latest pin). Write the comment in the same edit as the entry, update it whenever the entry's purpose or pin rationale changes, and delete it with the entry — a stale comment is worse than none.
  - `pnpm add --save-catalog` writes a caret range and a single-quoted key; change them to an exact pin and a double-quoted key to match the rest of the catalog, then update the lockfile in place with `pnpm install --lockfile-only` (an in-place update, not a from-scratch rebuild).
- Deleting or rebuilding a lockfile.
- Any destructive git operation (see the hard rule above — but also branch creation, stash, checkout of someone else's uncommitted work).
- Deploying to a real (non-LocalStack) AWS account.
- Anything not covered by an explicit phase/step already agreed in `docs/PLAN.md` — when in doubt about scope, stop and ask rather than extending the current step.

## Local dev-loop gotcha — read this before touching `infra`

**Any redeploy onto an already-running LocalStack stack that includes API Gateway breaks the Stage**, even for a change as small as editing the Lambda handler's code, with no error — `cdklocal deploy` reports success, CloudFormation shows `UPDATE_COMPLETE`, but every request 404s afterward. The only reliable fix is a full `cdklocal destroy --force` followed by a fresh `cdklocal deploy`. Treat this as the standard local iteration loop for `infra` — never assume an incremental update is safe to test against. CI is unaffected since it always starts from a fresh LocalStack container.

## Other confirmed gotchas (proven during the Phase 1 spike — see `docs/PLAN.md` for full detail)

- `typescript` is pinned to exactly `6.0.3` in every package — TS7's new native compiler breaks `ts-node`'s programmatic API (same root cause janggi's own `AGENTS.md` documents independently).
- `Idempotency-Key` travels as a native **SQS message attribute**, never spliced into the JSON message body via VTL string concatenation — that approach was tried and fails with a VTL parse error.
- DynamoDB's idempotency table needs `removalPolicy: RemovalPolicy.DESTROY` set explicitly — CDK's default is `RETAIN`, which is correct for production but breaks fresh redeploys of this ephemeral demo stack.
- Lambda runtime: use `nodejs22.x` or newer — `nodejs20.x` is already flagged deprecated.
- `esbuild` must be a devDependency wherever `NodejsFunction` is used, so CDK synth bundles without needing Docker (LocalStack's own Lambda *execution* still needs the Docker socket mounted — that's a separate, required thing).
- `LOCALSTACK_AUTH_TOKEN` lives in a gitignored `.env` at the repo root — load it (`set -a; source .env; set +a`) before any command that talks to LocalStack. Never print it or commit it.

## Keeping context small

Read only the part of a file you need. Don't `cat` an `AGENTS.md` already loaded into context this session. Keep this file itself lean — when a convention is superseded, remove the old text rather than layering a correction on top.
