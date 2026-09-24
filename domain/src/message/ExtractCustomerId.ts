import type {IncomingLedgerMessage} from "./types/IncomingLedgerMessage";

// From the message attribute alone, never the body: the customer comes from the caller's authenticated
// identity, so a client cannot claim to be someone else (docs/decisions/0003-kyc-gating.md).
export function extractCustomerId(message: IncomingLedgerMessage): string {
  return message.messageAttributes.CustomerId.stringValue;
}
