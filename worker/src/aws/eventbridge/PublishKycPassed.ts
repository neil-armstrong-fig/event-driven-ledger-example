import {PutEventsCommand, type EventBridgeClient} from "@aws-sdk/client-eventbridge";
import type {KycPassedEventDetail} from "@ledger/domain/events/BuildKycPassedEvent";

const EVENT_SOURCE = "ledger.worker";
const KYC_PASSED_DETAIL_TYPE = "KYC_PASSED_STUB";

interface PublishKycPassedOptions {
  client: EventBridgeClient;
  eventBusName: string;
  detail: KycPassedEventDetail;
}

export async function publishKycPassed({client, eventBusName, detail}: PublishKycPassedOptions): Promise<void> {
  const {FailedEntryCount} = await client.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName,
          Source: EVENT_SOURCE,
          DetailType: KYC_PASSED_DETAIL_TYPE,
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
