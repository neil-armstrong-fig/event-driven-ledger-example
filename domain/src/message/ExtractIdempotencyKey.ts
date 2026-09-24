import type {IncomingLedgerMessage} from "./types/IncomingLedgerMessage";

export function extractIdempotencyKey(message: IncomingLedgerMessage): string {
  return message.messageAttributes.IdempotencyKey.stringValue;
}
