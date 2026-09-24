import {randomUUID} from "node:crypto";

import {
  beforeEach,
  criterionThat as then,
  expect,
  given,
  when,
} from "@src/acceptance-criteria-mapping/AcceptanceCriteriaMapping";

const assetId = "asset-1";

// Same key, fresh `requestId`: a byte-identical body would be dropped by SQS FIFO content-based
// deduplication before the worker ever sees it, so it would prove nothing about the DynamoDB guard
// (docs/decisions/0001-dedup-vs-idempotency.md). Fresh for every criterion, as in the happy-path spec.
let customerId: string;
let idempotencyKey: string;
let statuses: number[];

given("a verified customer submits two requests that share an idempotency key", () => {
  beforeEach(async ({ledger}) => {
    customerId = `customer-${randomUUID()}`;
    idempotencyKey = `double-spend-${randomUUID()}`;
    await ledger.kyc.seedCustomer({customerId, status: "verified"});
    statuses = [
      await ledger.requests.submit({idempotencyKey, customerId, assetId, requestId: `request-${randomUUID()}`}),
      await ledger.requests.submit({idempotencyKey, customerId, assetId, requestId: `request-${randomUUID()}`}),
    ];
  });

  when("the API has answered", () => {
    then("it has accepted both", () => {
      expect(statuses).toEqual([202, 202]);
    });
  });

  when("the worker has recorded them", () => {
    beforeEach(async ({ledger}) => {
      await ledger.records.waitForRecord({customerId, idempotencyKey});
    });

    then("the request is recorded", async ({ledger}) => {
      expect(await ledger.records.isRecorded({customerId, idempotencyKey})).toBe(true);
    });
  });

  when("the worker has announced them", () => {
    beforeEach(async ({ledger}) => {
      // Two, not one: the duplicate emits too (docs/decisions/0002-dual-write.md — at-least-once).
      await ledger.events.waitForKycPassedEvents(idempotencyKey, {atLeast: 2});
    });

    then("every announcement carries that key and customer", async ({ledger}) => {
      const events = await ledger.events.getKycPassedEventsFor(idempotencyKey);
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.every(event => event.idempotencyKey === idempotencyKey && event.customerId === customerId)).toBe(
        true,
      );
    });
  });
});
