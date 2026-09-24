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
      LedgerDsl.ts               the root; members requests, kyc, records, events
      types/                     LedgerEndpoints — where the deployed stack's pieces live
      aws/                       the root's counterpart: reads them from the stack's CloudFormation outputs
                                 (its helpers in stack-outputs/)
      components/{requests,kyc,records,events}/   each a *Dsl + aws/*Client.ts (+ types/ for its plain shapes)
  tests/                         the specs, by subject (none yet)
```

## Waiting is `eventually(poll, timeout)`, never a fixed `sleep`

"Waits briefly" for the DynamoDB record or the emitted event is a poll-with-timeout inside a
`*Client`, not a hardcoded delay — a fixed sleep is either too slow (every run) or too fast (flaky under
load) and says nothing about why it failed.

## The scenarios

Every request comes from a customer (`Customer-Id`), and the ledger decides against that customer's KYC
status. **The KYC table has no writer in the stack**, so a spec seeds it with `ledger.kyc.seedCustomer`
before it submits — standing in for the provider's feed (`docs/decisions/0003-kyc-gating.md`).

1. **Happy path**, a verified customer: submit → 202 → the request is recorded as passed, on the verified
   KYC it relied on and stamped with a recent time → exactly one `KYC_PASSED` for that customer and asset.
2. **A customer who has not passed KYC** (pending, rejected, expired, nothing on record): still 202, since
   the API queues without looking → recorded as rejected, with the reason and the status it relied on → one
   `KYC_REJECTED` carrying the reason, and never a `KYC_PASSED`.
3. **Double-spend**: two requests with the **same `Idempotency-Key`** but a **different `requestId`**
   (so SQS content-based dedup lets both through) → the key is recorded (the table key keeps it to one record), and every emitted
   event carries that same key and customer — not "exactly one event" (Gap #2, Option A: at-least-once).
   Explained in `docs/decisions/0001-dedup-vs-idempotency.md` / `0002-dual-write.md`.
4. **Replay of a rejection**: rejected while pending, the customer is then verified, the same key again →
   still announced as rejected, never passed. A repeat replays the decision on record.
5. **Anonymous**: a request with no `Customer-Id` gets a 400 from the API itself, before it is queued.
6. **Two customers, one key**: a verified customer's request is announced as passed, then a pending customer sends
   the same `Idempotency-Key` → theirs is decided on their own KYC, recorded and announced as rejected for them, and
   the key is still announced as passed only for the first (`docs/decisions/0004-customer-scoped-idempotency.md`).

## Read back what was written, not only that something was

A spec that only asks "is it recorded?" lets a wrong _value_ through. Mutation testing showed it: the KYC
status the decision relied on, and its timestamp, could be dropped or corrupted without failing one spec,
until a spec read the record back (`ledger.records.getRecordedRequestFor`). When the system writes
something a later decision depends on, assert on what it wrote.

## EventBridge assertion needs its own sink

There's no way to query "was this event emitted", so an EventBridge rule (`detail-type:
["KYC_PASSED", "KYC_REJECTED"]`) stores every event in a DynamoDB table — via a one-state Step Functions state
machine, so there is no handler code — keyed by `idempotencyKey` then the event's own id (two events for
one key are both kept). Each item holds the `detailType` and the whole `detail` as JSON, which `EventsClient` parses. Reading it consumes nothing and asks about one key only, so **specs can run in
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

**On WSL without Docker integration**, call the Windows CLI (`/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe`)
and `export WSLENV=LOCALSTACK_AUTH_TOKEN` first, or the container never sees the token. The
`-v /var/run/docker.sock:…` mount still works, because Docker Desktop resolves it inside its own VM.

The stack is named by `LEDGER_STACK_NAME` (default `LedgerStack`). The SDK clients read the endpoint and
credentials from `AWS_ENDPOINT_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`;
`vitest.acceptance.config.ts` defaults them to LocalStack and dummy credentials, so nothing needs
exporting. To run the same specs against a real deployment, set `ACCEPTANCE_TARGET=aws`: nothing is
defaulted then, so the SDK uses your own AWS credentials and region (deploy first with `pnpm --dir infra
deploy:aws`; deploying to a real account is your call, agents ask first). CI always uses LocalStack. The API URL LocalStack outputs (`…execute-api.localhost.localstack.cloud:4566`) is used as is.

## Test data is fresh for every criterion

Unlike a browser page, **the deployed stack is shared and outlives a run.** A reused idempotency key finds
last run's record; a reused message body is dropped by SQS FIFO content-based deduplication for five
minutes (`docs/decisions/0001-dedup-vs-idempotency.md`) — the API still answers 202, no record and no event ever appear, and the
failure looks like a broken worker. Generate the key, the `requestId` and the `customerId` in the `given`'s `beforeEach` (each
`then` re-runs it), not at module level. Give each `when` one thing to wait for, so a criterion fails for
its own reason and not because a sibling's wait timed out.
