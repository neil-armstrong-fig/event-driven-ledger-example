import {extractIdempotencyKey} from "./ExtractIdempotencyKey";
import type {IncomingLedgerMessage} from "./IncomingLedgerMessage";

it("extracts the idempotency key from the SQS message attribute", () => {
  const message: IncomingLedgerMessage = {
    messageAttributes: {IdempotencyKey: {stringValue: "idem-001"}},
    body: JSON.stringify({assetId: "asset-1", requestId: "req-1"}),
  };

  expect(extractIdempotencyKey(message)).toBe("idem-001");
});

it("ignores an idempotencyKey-shaped field in the body, sourcing only from the message attribute", () => {
  const message: IncomingLedgerMessage = {
    messageAttributes: {IdempotencyKey: {stringValue: "idem-002"}},
    body: JSON.stringify({assetId: "asset-1", requestId: "req-1", idempotencyKey: "body-idem-999"}),
  };

  expect(extractIdempotencyKey(message)).toBe("idem-002");
});

it("returns the same idempotency key for two messages sharing it but differing in requestId", () => {
  const first: IncomingLedgerMessage = {
    messageAttributes: {IdempotencyKey: {stringValue: "idem-003"}},
    body: JSON.stringify({assetId: "asset-1", requestId: "req-a"}),
  };
  const second: IncomingLedgerMessage = {
    messageAttributes: {IdempotencyKey: {stringValue: "idem-003"}},
    body: JSON.stringify({assetId: "asset-1", requestId: "req-b"}),
  };

  expect(extractIdempotencyKey(first)).toBe("idem-003");
  expect(extractIdempotencyKey(second)).toBe("idem-003");
});
