# TODO — Event-Driven Ledger

Resuming cold (new agent, new tool, cleared context)? Read `docs/PLAN.md` in full first — it has the complete context, decisions, and Phase 1 spike findings this checklist assumes you already know. Do not skip it; several items below only make sense with that background (e.g. "use the message-attribute approach" refers to a specific bug found and fixed during the spike, documented there).

**Working directory**: `/home/neil/development/practice/event-driven-ledger` (git repo, branch `main`).

**Ground rule from Neil**: he wants to be involved at every step. Each numbered item below is its own stop — implement one, show the result, wait for explicit go-ahead before the next. Do not batch multiple items into one turn of work. This applies regardless of which agent/tool is driving.

## Status

- [x] Phase 1 — LocalStack spike (throwaway, cleaned up). All 6 integrations proven working. See `docs/PLAN.md` for full findings and gotchas.
- [x] Phase 2, step 1 — `git init` done, `.gitignore` committed (excludes CV file + `*:Zone.Identifier` + `node_modules` etc.)
- [ ] **Phase 2, step 2 — NEXT ACTION**: pnpm workspace + 5 empty packages (`shared`, `domain`, `worker`, `infra`, `acceptance-tests`). Verify `.gitignore` still covers everything.
- [ ] Phase 2, step 3 — shared tool config factories (`eslint.base.js`, `prettier.base.js`, `tsconfig.base.json` with TypeScript pinned to `6.0.3`, `vitest.base.ts`)
- [ ] Phase 2, step 4 — root + per-package `AGENTS.md` files
- [ ] Phase 3 — `domain` package, TDD (idempotency-key handling, `KYC_PASSED_STUB` event payload builder)
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
