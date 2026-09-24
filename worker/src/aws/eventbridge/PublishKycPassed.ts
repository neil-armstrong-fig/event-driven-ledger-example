import type {EventBridgeClient} from "@aws-sdk/client-eventbridge";
import type {KycPassedEventDetail} from "@ledger/domain/kyc/events/types/KycPassedEventDetail";
import {KYC_DETAIL_TYPES} from "@ledger/shared/events/KycDetailTypes";

import {publishEvent} from "@src/aws/eventbridge/PublishEvent";

interface PublishKycPassedOptions {
  client: EventBridgeClient;
  eventBusName: string;
  detail: KycPassedEventDetail;
}

export function publishKycPassed({client, eventBusName, detail}: PublishKycPassedOptions): Promise<void> {
  return publishEvent({client, eventBusName, detailType: KYC_DETAIL_TYPES.passed, detail});
}
