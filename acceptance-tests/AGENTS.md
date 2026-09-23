# AGENTS.md — acceptance-tests

ATDD DSL + given/when/then specs, run against a real deployed LocalStack stack — see the root
`AGENTS.md` package table. **No `src/` yet.** This is Phase 6, after `infra` (Phase 4) and `worker`
(Phase 5) both exist and can actually be deployed to LocalStack for these specs to run against.

## Import boundary

`eslint.config.js`: `allowedPackages: ["@ledger/shared"]`. Beyond that lint-enforced boundary, the
target layering (per `docs/PLAN.md`, mirroring janggi's DSL/mechanics split) is:

```
dsl/*Dsl.ts      business vocabulary only — submitFractionalizationRequest, theRecordExists,
                 theEventWasEmitted — Action/Question/Query naming, never an AWS SDK call directly
aws/*Client.ts   the actual fetch/AWS-SDK calls — LedgerApiClient.ts, LedgerAwsResourcesClient.ts —
                 real errors propagate raw, no swallowing
```

This isn't lint-enforced yet (no `dsl/`/`aws/` folders exist), but when they're created, keep AWS SDK
calls out of `dsl/*` from the first commit — retrofitting the split later, once specs already call the
SDK directly, is much more painful than starting with it.

## Acceptance specs are the _opposite_ of the unit-test convention

Root `AGENTS.md`'s "no wrapper `describe`" rule is for `domain` unit tests. Here, nested
`given`/`when`/`then` **is** the specification, not a wrapper to avoid — write it deliberately nested.

## "Waits briefly" means `eventually(poll, timeout)`, never a fixed `sleep`

The scenario brief says the test "waits briefly" for the DynamoDB record to appear after the API call
returns 202. Implement that as a poll-with-timeout helper, not a hardcoded delay — a fixed sleep is
either too slow (wastes time every run) or too fast (flaky under load) and tells you nothing about why
it failed when it does.

## The two proven scenarios to automate (Phase 6, steps 3–4)

1. **Happy path**: submit → 202 → poll → exactly one DynamoDB record → exactly one EventBridge event.
2. **Double-spend**: two requests with the **same `Idempotency-Key` header** but a **different**
   `requestId` field in the body (so SQS content-based dedup lets both through as distinct messages) →
   exactly one DynamoDB record results, because the DynamoDB conditional write is what actually blocks
   the second one. This exact shape was proven manually in the Phase 1 spike (see `docs/PLAN.md` Phase
   1 results, item 7) — automate it as written there, don't redesign it.

## EventBridge assertion needs its own sink

There's no way to directly query "was this event emitted" — the proven pattern (Phase 1 spike) is an
EventBridge rule (`detail-type: ["KYC_PASSED_STUB"]`) targeting a temporary SQS queue, with a queue
policy granting `events.amazonaws.com` send permission. **This sink must be deployed only behind a CDK
context flag**, so it never ships in a real (non-test) deployment — verify that flag actually gates it
before calling Phase 6 step 5 done.

## Running against LocalStack

Needs `LOCALSTACK_AUTH_TOKEN` from the gitignored root `.env` — `set -a; source .env; set +a` before
anything that talks to LocalStack. Never print or commit it. Remember `infra`'s dev-loop gotcha
(`infra/AGENTS.md`): a stack these specs will hit must have been freshly `destroy`ed and `deploy`ed,
never left over from an incremental update, or every request 404s for reasons that have nothing to do
with the spec itself.
