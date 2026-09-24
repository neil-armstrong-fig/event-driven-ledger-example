import {extractCustomerId} from "./ExtractCustomerId";
import type {IncomingLedgerMessage} from "./types/IncomingLedgerMessage";

it("extracts the customer id from the SQS message attribute", () => {
  const message: IncomingLedgerMessage = {
    messageAttributes: {IdempotencyKey: {stringValue: "idem-001"}, CustomerId: {stringValue: "customer-1"}},
    body: JSON.stringify({assetId: "asset-1", requestId: "req-1"}),
  };

  expect(extractCustomerId(message)).toBe("customer-1");
});

it("ignores a customerId-shaped field in the body, so a client cannot claim to be someone else", () => {
  const message: IncomingLedgerMessage = {
    messageAttributes: {IdempotencyKey: {stringValue: "idem-001"}, CustomerId: {stringValue: "customer-1"}},
    body: JSON.stringify({assetId: "asset-1", requestId: "req-1", customerId: "customer-999"}),
  };

  expect(extractCustomerId(message)).toBe("customer-1");
});
