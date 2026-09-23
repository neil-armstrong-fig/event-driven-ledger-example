# AGENTS.md — acceptance-tests

Vitest runs the specs against a real deployed LocalStack stack. Four layers, and imports only ever
point downwards:

```
src/tests/                        the mapping, "@src/shared/*" and @ledger/shared, nothing else
src/acceptance-criteria-mapping/  src/dsl/ and src/shared/; never src/tests/
src/dsl/                          itself and src/shared/; never upwards
src/shared/                       helpers more than one layer needs — none yet, so no folder yet
```

Every arrow above is a lint rule, so a violation fails `pnpm checks`. This is the same layering as the
developer's janggi repo, with the AWS SDK where Playwright is there.

`src/dsl/AGENTS.md` covers building the DSL (the `*Dsl`/`*Client` pairing, naming a method).
`src/tests/AGENTS.md` covers writing specs (`given`/`when`/`then`, arranging in a `beforeEach`).

## What a spec may reach

The DSL, and nothing else — no AWS SDK, no `fetch`, no endpoints. **`@ledger/shared` is allowed** (its
vocabulary should be used for assertions once it holds any). Enforced three ways: the argument type,
`withDslOnly` rebuilding the argument object at runtime, and a lint rule banning the SDK, `fetch` and
`@src/dsl/**` under `src/tests/`.

**Do not work around it.** To give a spec a new capability, add the SDK/`fetch` work to a `*Client`,
then the one-line wrapper for it on the `*Dsl` beside it.

## Layout

```
src/
  acceptance-criteria-mapping/   given/when/then/beforeEach + the `ledger` fixture
  dsl/
    errors/DslError.ts
    shared/polling/Eventually.ts helpers more than one *Client needs
    ledger/
      LedgerDsl.ts               the root; members requests, records, events
      types/                     LedgerEndpoints — where the deployed stack's pieces live
      aws/                       the root's counterpart: reads them from the stack's CloudFormation outputs
                                 (its helpers in stack-outputs/)
      components/{requests,records,events}/   each a *Dsl + aws/*Client.ts (+ types/ for its plain shapes)
  tests/                         the specs, by subject (none yet)
```

## Waiting is `eventually(poll, timeout)`, never a fixed `sleep`

"Waits briefly" for the DynamoDB record or the emitted event is a poll-with-timeout inside a
`*Client`, not a hardcoded delay — a fixed sleep is either too slow (every run) or too fast (flaky under
load) and says nothing about why it failed.

## The two scenarios to automate (Phase 6, steps 3–4)

1. **Happy path**: submit → 202 → wait → exactly one DynamoDB record → an event emitted.
2. **Double-spend**: two requests with the **same `Idempotency-Key`** but a **different `requestId`**
   (so SQS content-based dedup lets both through) → exactly one DynamoDB record, and every emitted
   event carries that same key — not "exactly one event" (Gap #2, Option A: at-least-once). Proven
   manually in the Phase 1 spike (`docs/PLAN.md` Phase 1 results, item 7) — automate it as written.

## EventBridge assertion needs its own sink

There's no way to query "was this event emitted", so an EventBridge rule (`detail-type:
["KYC_PASSED_STUB"]`) stores every event in a DynamoDB table — via a one-state Step Functions state
machine, so there is no handler code — keyed by `idempotencyKey` then the event's own id (two events for
one key are both kept). Reading it consumes nothing and asks about one key only, so **specs can run in
parallel without seeing each other's events**; that is why the sink is a table and not the queue it
started as (a shared queue is consumed by whoever reads it, and its orphaned events crowd out real ones).
**This sink must be deployed only behind a CDK context flag**,
so it never ships in a real deployment. It is `LedgerEventSink` in `infra`, gated by
`-c includeEventSink=true`, which also adds the `LedgerSinkTableName` output the fixture reads —
**`deploy:local` passes it; deploy without it and every spec fails at setup.** `LedgerStack.test.ts` asserts the flag gates
it (verified by making the gate unconditional and watching the test fail).

## Traps

- **A module exporting `then` never finishes loading under Vitest** — a `then` export makes it a
  thenable, and Vitest awaits the import. So the mapping exports `criterionThat` and each spec imports
  it `as then`. Do not "tidy" that back.
- **Vitest fixtures need an object-destructuring first argument**, even one that depends on nothing —
  hence the `({}, use)` and its scoped `eslint-disable` in `AcceptanceTestFixtures`.

## Running

Needs LocalStack up with `LOCALSTACK_AUTH_TOKEN` from the gitignored root `.env` (`set -a; source .env;
set +a`; never print or commit it) and Docker's socket mounted — the Lambda runs in a container:

```bash
docker run -d --rm --name ledger-localstack -p 127.0.0.1:4566:4566 -e LOCALSTACK_AUTH_TOKEN \
  -v /var/run/docker.sock:/var/run/docker.sock localstack/localstack:latest
pnpm --dir infra exec cdklocal bootstrap   # once per LocalStack container
pnpm --dir infra deploy:local              # destroy, then a fresh deploy with the event sink
pnpm acceptance-tests                      # the specs, against the deployed stack
pnpm test                                  # Vitest for DSL helpers (Eventually); excludes src/tests/
```

`deploy:local` **destroys first on purpose** — `infra/AGENTS.md`'s dev-loop gotcha: an incremental
redeploy onto a running stack breaks the API Gateway Stage and every request 404s for reasons that have
nothing to do with a spec. Redeploy after any `infra` or `worker` change; the specs test the deployed
artifact, not your working tree.

The stack is named by `LEDGER_STACK_NAME` (default `LedgerStack`). The SDK clients read the endpoint and
credentials from `AWS_ENDPOINT_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`;
`vitest.acceptance.config.ts` defaults them to LocalStack and dummy credentials, so nothing needs
exporting. The API URL LocalStack outputs (`…execute-api.localhost.localstack.cloud:4566`) is used as is.

## Test data is fresh for every criterion

Unlike a browser page, **the deployed stack is shared and outlives a run.** A reused idempotency key finds
last run's record; a reused message body is dropped by SQS FIFO content-based deduplication for five
minutes (`docs/PLAN.md` Gap #1) — the API still answers 202, no record and no event ever appear, and the
failure looks like a broken worker. Generate the key and `requestId` in the `given`'s `beforeEach` (each
`then` re-runs it), not at module level. Give each `when` one thing to wait for, so a criterion fails for
its own reason and not because a sibling's wait timed out.
