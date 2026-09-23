import {parseKycPassedEvent} from "./ParseKycPassedEvent";

function envelope(fields: Record<string, unknown>): string {
  return JSON.stringify({source: "ledger.worker", ...fields});
}

it("extracts the business payload from a KYC_PASSED_STUB envelope", () => {
  const body = envelope({"detail-type": "KYC_PASSED_STUB", detail: {assetId: "asset-1", idempotencyKey: "idem-1"}});

  expect(parseKycPassedEvent(body)).toEqual({assetId: "asset-1", idempotencyKey: "idem-1"});
});

it("ignores an event of any other detail-type", () => {
  const body = envelope({"detail-type": "SOMETHING_ELSE", detail: {assetId: "asset-1", idempotencyKey: "idem-1"}});

  expect(parseKycPassedEvent(body)).toBeUndefined();
});

it("ignores a KYC_PASSED_STUB envelope whose detail is missing a field", () => {
  const body = envelope({"detail-type": "KYC_PASSED_STUB", detail: {assetId: "asset-1"}});

  expect(parseKycPassedEvent(body)).toBeUndefined();
});
