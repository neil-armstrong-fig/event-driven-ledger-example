import {buildKycRejectedEvent} from "./BuildKycRejectedEvent";

it("builds the KYC_REJECTED event detail from the asset, key, customer and reason", () => {
  const detail = buildKycRejectedEvent({
    assetId: "asset-1",
    idempotencyKey: "idem-001",
    customerId: "customer-1",
    reason: "expired",
  });

  expect(detail).toEqual({assetId: "asset-1", idempotencyKey: "idem-001", customerId: "customer-1", reason: "expired"});
});

it("builds a distinct detail for a distinct reason", () => {
  const detail = buildKycRejectedEvent({
    assetId: "asset-1",
    idempotencyKey: "idem-001",
    customerId: "customer-1",
    reason: "pending",
  });

  expect(detail.reason).toBe("pending");
});
