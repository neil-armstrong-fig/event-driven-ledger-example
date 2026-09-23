export interface IncomingLedgerMessage {
  messageAttributes: {
    IdempotencyKey: {
      stringValue: string;
    };
  };
  body: string;
}

export function extractIdempotencyKey(message: IncomingLedgerMessage): string {
  return message.messageAttributes.IdempotencyKey.stringValue;
}
