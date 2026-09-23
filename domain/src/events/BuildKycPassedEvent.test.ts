import {buildKycPassedEvent} from "./BuildKycPassedEvent";

it("builds the KYC_PASSED_STUB event detail from the asset id and idempotency key", () => {
  const detail = buildKycPassedEvent({assetId: "asset-1", idempotencyKey: "idem-001"});

  expect(detail).toEqual({assetId: "asset-1", idempotencyKey: "idem-001"});
});

it("builds a distinct detail per asset id and idempotency key pair", () => {
  const detail = buildKycPassedEvent({assetId: "asset-2", idempotencyKey: "idem-002"});

  expect(detail).toEqual({assetId: "asset-2", idempotencyKey: "idem-002"});
});
