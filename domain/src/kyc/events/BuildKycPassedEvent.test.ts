import {buildKycPassedEvent} from "./BuildKycPassedEvent";

it("builds the KYC_PASSED event detail from the asset, idempotency key and customer", () => {
  const detail = buildKycPassedEvent({assetId: "asset-1", idempotencyKey: "idem-001", customerId: "customer-1"});

  expect(detail).toEqual({assetId: "asset-1", idempotencyKey: "idem-001", customerId: "customer-1"});
});

it("builds a distinct detail per asset, idempotency key and customer", () => {
  const detail = buildKycPassedEvent({assetId: "asset-2", idempotencyKey: "idem-002", customerId: "customer-2"});

  expect(detail).toEqual({assetId: "asset-2", idempotencyKey: "idem-002", customerId: "customer-2"});
});
