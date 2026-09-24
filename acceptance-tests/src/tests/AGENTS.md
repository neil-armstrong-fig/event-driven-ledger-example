# AGENTS.md — tests

```ts
import {
  beforeEach,
  criterionThat as then,
  expect,
  given,
  when,
} from "@src/acceptance-criteria-mapping/AcceptanceCriteriaMapping";

let status: number;

given("a verified customer submits a fractionalization request", () => {
  beforeEach(async ({ledger}) => {
    await ledger.kyc.seedCustomer({customerId: "c1", status: "verified"});
    status = await ledger.requests.submit({idempotencyKey: "k1", customerId: "c1", assetId: "a1", requestId: "r1"});
  });

  when("the API has answered", () => {
    then("it is accepted", () => {
      expect(status).toBe(202);
    });
  });

  when("the worker has processed it", () => {
    beforeEach(async ({ledger}) => {
      await ledger.records.waitForRecord("k1");
    });

    then("the request is recorded", async ({ledger}) => {
      expect(await ledger.records.isRecorded("k1")).toBe(true);
    });
  });
});
```

`given`/`when` are `describe`; `then` is `it`, which is why only `then` receives the DSL. The import
says `criterionThat as then` because of a Vitest loading trap — see `acceptance-tests/AGENTS.md`.
**Generate the idempotency key, `requestId` and `customerId` in the `beforeEach`, not at module level** — the deployed stack is shared and outlives a run (`acceptance-tests/AGENTS.md`, "Test data is fresh").
State a `beforeEach` produces for a `then` is a module-level `let`, assigned in the `beforeEach`.

## Arrange in a `beforeEach`, assert in the `then`

**A `then` states one criterion and checks it. It does not set anything up.** Whatever a `given` or a
`when` says has happened is made to happen in a `beforeEach` on that block. A lint rule enforces it
(`no-restricted-syntax` in this package's `eslint.config.js`): calling a DSL _action_ inside a `then`
fails `pnpm checks`. **That list cannot be derived, so adding an action to the DSL means adding it to
the rule too.**

**Root `AGENTS.md`'s ban on a wrapper `describe` does not apply here.** There it stops a unit test
restating its filename; here the `given`/`when` nesting **is** the acceptance criterion — write the full
three levels even when a `given` holds one `when`. The ban does still apply to the Vitest unit tests for
DSL helpers.

Name a spec file for what it is about (`SubmittingARequest.test.ts`), under a folder for its subject.
Specs run against a deployed LocalStack stack, so they are excluded from `pnpm test`/`pnpm checks` and
run with `pnpm acceptance-tests`.
