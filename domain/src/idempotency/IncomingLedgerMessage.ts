export interface IncomingLedgerMessage {
  messageAttributes: {
    IdempotencyKey: {
      stringValue: string;
    };
  };
  body: string;
}
