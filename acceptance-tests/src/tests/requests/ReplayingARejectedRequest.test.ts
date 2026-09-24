import {randomUUID} from "node:crypto";

import {
  beforeEach,
  criterionThat as then,
  expect,
  given,
  when,
} from "@src/acceptance-criteria-mapping/AcceptanceCriteriaMapping";

const assetId = "asset-1";

// A repeat of an idempotency key replays the decision on record; it is never decided afresh
// (docs/decisions/0003-kyc-gating.md). The `requestId` is fresh for the repeat so SQS FIFO content-based
// deduplication does not drop it before the worker sees it (docs/decisions/0001-dedup-vs-idempotency.md).
let customerId: string;
let idempotencyKey: string;

given("a request was rejected because the customer's KYC was pending", () => {
  beforeEach(async ({ledger}) => {
    customerId = `customer-${randomUUID()}`;
    idempotencyKey = `replayed-rejection-${randomUUID()}`;
    await ledger.kyc.seedCustomer({customerId, status: "pending"});
    await ledger.requests.submit({idempotencyKey, customerId, assetId, requestId: `request-${randomUUID()}`});
    await ledger.events.waitForKycRejectedEvents(idempotencyKey, {atLeast: 1});
  });

  when("the customer has since been verified and repeats the request under the same key", () => {
    beforeEach(async ({ledger}) => {
      await ledger.kyc.seedCustomer({customerId, status: "verified"});
      await ledger.requests.submit({idempotencyKey, customerId, assetId, requestId: `request-${randomUUID()}`});
      // Two, not one: the repeat emits too (docs/decisions/0002-dual-write.md — at-least-once).
      await ledger.events.waitForKycRejectedEvents(idempotencyKey, {atLeast: 2});
    });

    then("the repeat is announced as rejected again, as first decided", async ({ledger}) => {
      const events = await ledger.events.getKycRejectedEventsFor(idempotencyKey);
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.every(event => event.reason === "pending")).toBe(true);
    });

    then("it is never announced as passed", async ({ledger}) => {
      expect(await ledger.events.getKycPassedEventsFor(idempotencyKey)).toEqual([]);
    });
  });
});
