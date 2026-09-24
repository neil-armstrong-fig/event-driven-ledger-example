import type {IncomingLedgerMessage} from "@ledger/domain/message/types/IncomingLedgerMessage";

export interface LedgerBatchRecord extends IncomingLedgerMessage {
  messageId: string;
  attributes: {MessageGroupId: string};
}
