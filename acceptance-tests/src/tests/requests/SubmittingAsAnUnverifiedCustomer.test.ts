import {randomUUID} from "node:crypto";

import {
  beforeEach,
  criterionThat as then,
  expect,
  given,
  when,
} from "@src/acceptance-criteria-mapping/AcceptanceCriteriaMapping";

const assetId = "asset-1";
const A_YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

// Whatever the customer's KYC state, the API answers 202: it queues without looking. The worker decides,
// records the decision and announces it (docs/decisions/0003-kyc-gating.md).
const unverifiedCustomers = [
  {
    description: "a customer whose KYC is still pending",
    reason: "pending",
    kycStatus: "pending",
    seed: (customerId: string) => ({customerId, status: "pending" as const}),
  },
  {
    description: "a customer whose KYC was rejected",
    reason: "not-verified",
    kycStatus: "rejected",
    seed: (customerId: string) => ({customerId, status: "rejected" as const}),
  },
  {
    description: "a customer whose KYC has expired",
    reason: "expired",
    kycStatus: "verified",
    seed: (customerId: string) => ({customerId, status: "verified" as const, expiresAt: A_YEAR_AGO}),
  },
  {
    description: "a customer with no KYC on record",
    reason: "not-verified",
    kycStatus: undefined,
    seed: undefined,
  },
];

for (const {description, reason, kycStatus, seed} of unverifiedCustomers) {
  // Fresh for every criterion — see SubmittingAFractionalizationRequest.test.ts.
  let customerId: string;
  let idempotencyKey: string;
  let status: number;

  given(`${description} submits a fractionalization request`, () => {
    beforeEach(async ({ledger}) => {
      customerId = `customer-${randomUUID()}`;
      idempotencyKey = `unverified-${randomUUID()}`;
      if (seed) {
        await ledger.kyc.seedCustomer(seed(customerId));
      }
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
        await ledger.records.waitForRecord(idempotencyKey);
      });

      then("the request is recorded", async ({ledger}) => {
        expect(await ledger.records.isRecorded(idempotencyKey)).toBe(true);
      });

      then(`it is recorded as rejected, because ${reason}, on the KYC status it relied on`, async ({ledger}) => {
        const recorded = await ledger.records.getRecordedRequestFor(idempotencyKey);
        expect({outcome: recorded?.outcome, reason: recorded?.reason, kycStatus: recorded?.kycStatus}).toEqual({
          outcome: "rejected",
          reason,
          kycStatus,
        });
      });
    });

    when("the worker has announced it", () => {
      beforeEach(async ({ledger}) => {
        await ledger.events.waitForKycRejectedEvents(idempotencyKey, {atLeast: 1});
      });

      then(`KYC has been announced as rejected, because ${reason}`, async ({ledger}) => {
        expect(await ledger.events.getKycRejectedEventsFor(idempotencyKey)).toEqual([
          {assetId, idempotencyKey, customerId, reason},
        ]);
      });

      then("KYC has not been announced as passed", async ({ledger}) => {
        expect(await ledger.events.getKycPassedEventsFor(idempotencyKey)).toEqual([]);
      });
    });
  });
}
