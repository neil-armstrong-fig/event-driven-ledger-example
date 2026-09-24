import {PutEventsCommand, type EventBridgeClient} from "@aws-sdk/client-eventbridge";

const EVENT_SOURCE = "ledger.worker";

interface PublishEventOptions {
  client: EventBridgeClient;
  eventBusName: string;
  detailType: string;
  detail: object;
}

export async function publishEvent({client, eventBusName, detailType, detail}: PublishEventOptions): Promise<void> {
  const {FailedEntryCount} = await client.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName,
          Source: EVENT_SOURCE,
          DetailType: detailType,
          Detail: JSON.stringify(detail),
        },
      ],
    }),
  );

  // PutEvents reports per-entry failure in its response rather than throwing.
  if (FailedEntryCount) {
    throw new Error(`EventBridge rejected ${FailedEntryCount} event(s)`);
  }
}
