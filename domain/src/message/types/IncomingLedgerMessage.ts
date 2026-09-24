export interface IncomingLedgerMessage {
  messageAttributes: {
    IdempotencyKey: {
      stringValue: string;
    };
    CustomerId: {
      stringValue: string;
    };
  };
  body: string;
}
