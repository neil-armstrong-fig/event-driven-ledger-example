import {randomUUID} from "node:crypto";

import {
  beforeEach,
  criterionThat as then,
  expect,
  given,
  when,
} from "@src/acceptance-criteria-mapping/AcceptanceCriteriaMapping";

const assetId = "asset-1";

// An idempotency key belongs to the customer who sent it: another customer sending the same string is a different
// request, decided on their own KYC (docs/decisions/0004-customer-scoped-idempotency.md). The two customers get
// opposite outcomes, so a decision leaked from one to the other shows up as the wrong event. Each request has its own
// `requestId`, so SQS FIFO content-based deduplication lets both through (docs/decisions/0001-dedup-vs-idempotency.md).
let verifiedCustomerId: string;
let pendingCustomerId: string;
let idempotencyKey: string;

given("a verified customer's request under an idempotency key has been announced as passed", () => {
  beforeEach(async ({ledger}) => {
    verifiedCustomerId = `customer-${randomUUID()}`;
    pendingCustomerId = `customer-${randomUUID()}`;
    idempotencyKey = `shared-key-${randomUUID()}`;
    await ledger.kyc.seedCustomer({customerId: verifiedCustomerId, status: "verified"});
    await ledger.kyc.seedCustomer({customerId: pendingCustomerId, status: "pending"});
    await ledger.requests.submit({
      idempotencyKey,
      customerId: verifiedCustomerId,
      assetId,
      requestId: `request-${randomUUID()}`,
    });
    await ledger.events.waitForKycPassedEvents(idempotencyKey, {atLeast: 1});
  });

  when("another customer, whose KYC is pending, sends the same idempotency key", () => {
    beforeEach(async ({ledger}) => {
      await ledger.requests.submit({
        idempotencyKey,
        customerId: pendingCustomerId,
        assetId,
        requestId: `request-${randomUUID()}`,
      });
      await ledger.events.waitForKycRejectedEvents(idempotencyKey, {atLeast: 1});
    });

    then("each customer has their own record, decided on their own KYC", async ({ledger}) => {
      expect(
        await ledger.records.getRecordedRequestFor({customerId: verifiedCustomerId, idempotencyKey}),
      ).toMatchObject({
        customerId: verifiedCustomerId,
        outcome: "passed",
        kycStatus: "verified",
      });
      expect(await ledger.records.getRecordedRequestFor({customerId: pendingCustomerId, idempotencyKey})).toMatchObject(
        {
          customerId: pendingCustomerId,
          outcome: "rejected",
          reason: "pending",
          kycStatus: "pending",
        },
      );
    });

    then("the other customer's request is announced as rejected, for them", async ({ledger}) => {
      const events = await ledger.events.getKycRejectedEventsFor(idempotencyKey);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.every(event => event.customerId === pendingCustomerId && event.reason === "pending")).toBe(true);
    });

    then("the key is announced as passed only for the verified customer", async ({ledger}) => {
      const events = await ledger.events.getKycPassedEventsFor(idempotencyKey);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.every(event => event.customerId === verifiedCustomerId)).toBe(true);
    });
  });

  when("the other customer then repeats their request under that key", () => {
    beforeEach(async ({ledger}) => {
      await ledger.requests.submit({
        idempotencyKey,
        customerId: pendingCustomerId,
        assetId,
        requestId: `request-${randomUUID()}`,
      });
      await ledger.requests.submit({
        idempotencyKey,
        customerId: pendingCustomerId,
        assetId,
        requestId: `request-${randomUUID()}`,
      });
      // Two, not one: the repeat emits too, from the record on file (docs/decisions/0002-dual-write.md).
      await ledger.events.waitForKycRejectedEvents(idempotencyKey, {atLeast: 2});
    });

    then("the repeat is announced as rejected for them, as first decided", async ({ledger}) => {
      const events = await ledger.events.getKycRejectedEventsFor(idempotencyKey);
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.every(event => event.customerId === pendingCustomerId && event.reason === "pending")).toBe(true);
    });
  });
});
