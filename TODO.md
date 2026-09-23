# TODO — Event-Driven Ledger

Resuming cold (new agent, new tool, cleared context)? Read `docs/PLAN.md` in full first — it has the complete context, decisions, and Phase 1 spike findings this checklist assumes you already know. Do not skip it; several items below only make sense with that background (e.g. "use the message-attribute approach" refers to a specific bug found and fixed during the spike, documented there).

**Working directory**: `/home/neil/development/practice/event-driven-ledger` (git repo, branch `main`).

**Ground rule from Neil**: he wants to be involved at every step. Each numbered item below is its own stop — implement one, show the result, wait for explicit go-ahead before the next. Do not batch multiple items into one turn of work. This applies regardless of which agent/tool is driving.

**Git rule from Neil**: never run `git add`/`commit`/`push` or any staging/committing/branching command. He commits everything himself. Leave changes unstaged and describe what changed. See `AGENTS.md` for the full rule (one narrow exception already used: the initial `git init` + first `.gitignore` commit, done with his real-time approval — that does not extend further).

## Status

- [x] Phase 1 — LocalStack spike (throwaway, cleaned up). All 6 integrations proven working. See `docs/PLAN.md` for full findings and gotchas.
- [x] Phase 2, step 1 — `git init` done, `.gitignore` committed (excludes CV file + `*:Zone.Identifier` + `node_modules` etc.)
- [x] Root `AGENTS.md` written — standards in place before any package scaffolding, per Neil's request to have "a set of standards from the start." Committed in `be7ffa4`. Per-package `AGENTS.md` files still come later, once each package has real code to derive local convention from.
- [x] Phase 2, step 2 — pnpm workspace + 5 empty packages (`shared`, `domain`, `worker`, `infra`, `acceptance-tests`), each with a minimal `@ledger/<name>` `package.json`. Committed in `887cec2`. Verified this session: `git status --porcelain --ignored` shows `.env`, the CV file + its `Zone.Identifier`, and `node_modules/` all correctly ignored and nothing else untracked; `pnpm install --frozen-lockfile` succeeds across all 6 workspace projects.
- [x] Phase 2, step 3 — shared tool config factories (`shared/config/{eslint.base.js,prettier.base.js,tsconfig.base.json,vitest.base.ts}`, following janggi's factory pattern) wired into all 5 packages (each has its own `eslint.config.js`/`tsconfig.json`/`vitest.config.ts`/`prettier.config.js` + `checks`/`lint`/`format`/`type-check`/`test` scripts). Versions pinned via a pnpm workspace **catalog** (`catalogMode: strict` in `pnpm-workspace.yaml`) rather than repeated per-package literals — a deviation from janggi (which predates pnpm's catalog feature) adopted per Neil's request to research current pnpm pinning best practice. Latest versions except `typescript` (held at `6.0.3`, hard constraint) and `@types/node` (held at the `24.x` line to match the pinned Node runtime major). `pnpm checks` verified green across all 5 packages; import-boundary and AWS-SDK-ban rules verified to actually fire on bad imports *and* not false-positive on legitimate cross-package imports, with throwaway scratch files, then reverted. Neil to review the actual rule text per AGENTS.md step 5.
- [x] Phase 2, step 4 — per-package `AGENTS.md` files written for `shared`, `domain`, `worker`, `infra`, `acceptance-tests` (root one already done). Each states package purpose, its actual `eslint.config.js` import boundary, phase-specific TDD/build guidance, and package-specific gotchas (e.g. `infra`'s LocalStack destroy-before-redeploy loop, `worker`'s Gap #2 confirm-first step). All empty of `src/` still — said so explicitly rather than inventing structure ahead of real code. `pnpm exec prettier --check` verified green per package (root-level `AGENTS.md`/`docs/` are hand-formatted per janggi convention; package-level ones are not — Prettier normalizes `*emphasis*` to `_emphasis_`, caught and fixed this session). Neil to review the actual rule text per root `AGENTS.md` step 5 — flagged for him: some content duplicates root `AGENTS.md` (unit-test convention, idempotency-key-attribute note, infra gotchas) rather than the root file being trimmed, since editing the already-committed root file wasn't asked for; his call whether to consolidate.
- [x] Phase 3, step 1 — `domain` package, TDD: failing unit tests for idempotency-key handling written first, in `domain/src/idempotency/ExtractIdempotencyKey.test.ts` (3 flat `it`s, no wrapper `describe`): extracts from the message attribute, ignores an `idempotencyKey`-shaped field in the body, and — encoding Gap #1's already-resolved double-spend semantics — two messages sharing the same key but differing `requestId` both extract to that same key. Watched red for the right reason (`Cannot find module './ExtractIdempotencyKey'`, not a typo/config error) before writing any implementation. Neil reviewed and confirmed. Scope note: kept the message-attribute shape (`IncomingLedgerMessage`) local to `domain` rather than promoting it to `shared`, even though `shared/AGENTS.md` names this as the likely trigger moment for `shared`'s first content — `domain/AGENTS.md` permits either, and moving it would have touched a second package mid-step. Still Neil's call whether to promote it later.
- [x] **Phase 3 — NEXT ACTION**, step 2 — implementation to green: `domain/src/idempotency/ExtractIdempotencyKey.ts` reads `messageAttributes.IdempotencyKey.stringValue` only, never touches `body` — the minimal implementation that makes all 3 tests pass, including the differing-`requestId` one, without special-casing. `pnpm checks` green (lint + format + type-check + test) in `domain`. **STOP — Neil to review the two-gap scenario semantics baked into these tests before step 3.**
- [ ] Phase 4 — `infra` package, CDK stack built resource-by-resource (7 stops): FIFO queue+DLQ, DynamoDB table, EventBridge bus, API GW+validator+SQS integration, worker Lambda+event source mapping, least-privilege IAM, full-stack synth check
- [ ] Phase 5 — `worker` package, TDD (confirm Gap #2 dual-write approach with Neil first, then batch handler)
- [ ] Phase 6 — `acceptance-tests` package (AWS clients, DSL, happy-path spec, double-spend spec, EventBridge sink)
- [ ] Phase 7 — CI (`ci.yml` gate job + acceptance job with LocalStack service container)
- [ ] Phase 8 — `docs/architecture.md` (Mermaid diagram + prose + ADRs)

## Environment checklist (already set up — verify, don't redo)

- [x] Docker working in this WSL2 distro (Neil enabled Docker Desktop WSL integration)
- [x] `.env` at repo root has `LOCALSTACK_AUTH_TOKEN` (gitignored — free Hobby-tier account Neil created). Load with `set -a; source .env; set +a` before any command that needs it. **Never print this token or commit `.env`.**
- [x] Node `v24.13.1`, pnpm `12.3.4`, npm `11.8.0` confirmed installed
- [ ] No system `aws`/`awslocal`/`cdklocal`/`pip3` — use `npx aws-cdk-local` / `npx aws-cdk` / AWS SDK for JS directly, as the spike did

## Two open decisions to raise with Neil before/at Phase 5

1. **Gap #2 (dual-write)**: emit `KYC_PASSED_STUB` on `ConditionalCheckFailedException` too (at-least-once, simple) vs. document-only outbox pattern (DynamoDB Streams → EventBridge Pipes) as a diagram talking point, not built. Not yet decided.
2. Gap #1 (content-based dedup vs. DynamoDB guard) — **already resolved by design and proven in the Phase 1 spike**: use same `Idempotency-Key`, differing `requestId`, for the double-spend acceptance test. No further decision needed, just implement it this way.

## Hard constraints carried from the spike (see `docs/PLAN.md` "Bugs/gotchas" section for why)

- Pin `typescript` to exactly `6.0.3` in every package.
- `Idempotency-Key` travels as an **SQS message attribute**, never spliced into the JSON message body via VTL.
- DynamoDB table needs `removalPolicy: RemovalPolicy.DESTROY` explicitly.
- Lambda runtime: `nodejs22.x` or newer (not `nodejs20.x`, already deprecated).
- Local dev-loop against LocalStack: **always `cdklocal destroy --force` then fresh `cdklocal deploy`** when `infra` changes — incremental updates silently break the API Gateway Stage. This is a hard rule, not a suggestion — document it in `infra/AGENTS.md` too.
- `esbuild` must be a devDependency in `infra` (or wherever `NodejsFunction` lives) so bundling doesn't need Docker.
