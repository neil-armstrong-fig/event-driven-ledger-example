import type {IncomingLedgerMessage} from "@ledger/domain/idempotency/IncomingLedgerMessage";

export interface LedgerBatchRecord extends IncomingLedgerMessage {
  messageId: string;
  attributes: {MessageGroupId: string};
}
