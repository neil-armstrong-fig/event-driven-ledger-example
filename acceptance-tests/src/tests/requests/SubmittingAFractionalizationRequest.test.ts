import {randomUUID} from "node:crypto";

import {
  beforeEach,
  criterionThat as then,
  expect,
  given,
  when,
} from "@src/acceptance-criteria-mapping/AcceptanceCriteriaMapping";

const assetId = "asset-1";
// The worker and this spec share a clock only loosely (a container, a VM), so "now" is a generous window.
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

// Fresh for every criterion, unlike a browser page the deployed stack is shared: it outlives a run, so
// a reused key finds the old record, and a reused body is silently dropped by SQS FIFO content-based
// deduplication for five minutes (docs/decisions/0001-dedup-vs-idempotency.md) — no record, no event, and still a 202.
let customerId: string;
let idempotencyKey: string;
let status: number;

given("a verified customer submits a valid fractionalization request", () => {
  beforeEach(async ({ledger}) => {
    customerId = `customer-${randomUUID()}`;
    idempotencyKey = `happy-path-${randomUUID()}`;
    await ledger.kyc.seedCustomer({customerId, status: "verified"});
    status = await ledger.requests.submit({
      idempotencyKey,
      customerId,
      assetId,
      requestId: `request-${randomUUID()}`,
    });
  });

  when("the API has answered", () => {
    then("it has accepted the request", () => {
      expect(status).toBe(202);
    });
  });

  when("the worker has recorded it", () => {
    beforeEach(async ({ledger}) => {
      await ledger.records.waitForRecord({customerId, idempotencyKey});
    });

    then("the request is recorded", async ({ledger}) => {
      expect(await ledger.records.isRecorded({customerId, idempotencyKey})).toBe(true);
    });

    then("it is recorded as passed, on the verified KYC it relied on", async ({ledger}) => {
      expect(await ledger.records.getRecordedRequestFor({customerId, idempotencyKey})).toMatchObject({
        customerId,
        assetId,
        outcome: "passed",
        kycStatus: "verified",
      });
    });

    then("the decision is stamped with the time it was made", async ({ledger}) => {
      const recorded = await ledger.records.getRecordedRequestFor({customerId, idempotencyKey});
      expect(Math.abs(Date.now() - Date.parse(recorded?.decidedAt ?? ""))).toBeLessThan(CLOCK_TOLERANCE_MS);
    });
  });

  when("the worker has announced it", () => {
    beforeEach(async ({ledger}) => {
      await ledger.events.waitForKycPassedEvents(idempotencyKey, {atLeast: 1});
    });

    then("KYC has been announced as passed for that customer and asset, once", async ({ledger}) => {
      expect(await ledger.events.getKycPassedEventsFor(idempotencyKey)).toEqual([
        {assetId, idempotencyKey, customerId},
      ]);
    });
  });
});
