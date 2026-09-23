import type {IncomingLedgerMessage} from "@ledger/domain/idempotency/ExtractIdempotencyKey";

export interface LedgerBatchRecord extends IncomingLedgerMessage {
  messageId: string;
  attributes: {MessageGroupId: string};
}
