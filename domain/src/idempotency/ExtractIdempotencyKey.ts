import type {IncomingLedgerMessage} from "./IncomingLedgerMessage";

export function extractIdempotencyKey(message: IncomingLedgerMessage): string {
  return message.messageAttributes.IdempotencyKey.stringValue;
}
