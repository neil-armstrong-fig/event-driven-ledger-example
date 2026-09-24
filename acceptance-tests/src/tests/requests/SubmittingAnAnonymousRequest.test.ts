import {randomUUID} from "node:crypto";

import {
  beforeEach,
  criterionThat as then,
  expect,
  given,
  when,
} from "@src/acceptance-criteria-mapping/AcceptanceCriteriaMapping";

// A request must say who it is from, because everything after the API depends on it (docs/decisions/0003-kyc-gating.md).
// Fresh for every criterion — see SubmittingAFractionalizationRequest.test.ts.
let status: number;

given("a client submits a fractionalization request without saying who they are", () => {
  beforeEach(async ({ledger}) => {
    status = await ledger.requests.submitWithoutCustomer({
      idempotencyKey: `anonymous-${randomUUID()}`,
      assetId: "asset-1",
      requestId: `request-${randomUUID()}`,
    });
  });

  when("the API has answered", () => {
    then("it has rejected the request as invalid, before queueing it", () => {
      expect(status).toBe(400);
    });
  });
});
