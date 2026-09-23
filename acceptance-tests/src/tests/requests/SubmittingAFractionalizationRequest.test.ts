import {randomUUID} from "node:crypto";

import {
  beforeEach,
  criterionThat as then,
  expect,
  given,
  when,
} from "@src/acceptance-criteria-mapping/AcceptanceCriteriaMapping";

const assetId = "asset-1";

// Fresh for every criterion, unlike a browser page the deployed stack is shared: it outlives a run, so
// a reused key finds the old record, and a reused body is silently dropped by SQS FIFO content-based
// deduplication for five minutes (docs/PLAN.md Gap #1) — no record, no event, and still a 202.
let idempotencyKey: string;
let status: number;

given("a client submits a valid fractionalization request", () => {
  beforeEach(async ({ledger}) => {
    idempotencyKey = `happy-path-${randomUUID()}`;
    status = await ledger.requests.submit({idempotencyKey, assetId, requestId: `request-${randomUUID()}`});
  });

  when("the API has answered", () => {
    then("it has accepted the request", () => {
      expect(status).toBe(202);
    });
  });

  when("the worker has recorded it", () => {
    beforeEach(async ({ledger}) => {
      await ledger.records.waitForRecord(idempotencyKey);
    });

    then("the request is recorded", async ({ledger}) => {
      expect(await ledger.records.isRecorded(idempotencyKey)).toBe(true);
    });
  });

  when("the worker has announced it", () => {
    beforeEach(async ({ledger}) => {
      await ledger.events.waitForKycPassedEvents(idempotencyKey, {atLeast: 1});
    });

    then("KYC has been announced as passed for that asset, once", async ({ledger}) => {
      expect(await ledger.events.getKycPassedEventsFor(idempotencyKey)).toEqual([{assetId, idempotencyKey}]);
    });
  });
});
