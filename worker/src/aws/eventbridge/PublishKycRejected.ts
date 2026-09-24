import type {EventBridgeClient} from "@aws-sdk/client-eventbridge";
import type {KycRejectedEventDetail} from "@ledger/domain/kyc/events/types/KycRejectedEventDetail";
import {KYC_DETAIL_TYPES} from "@ledger/shared/events/KycDetailTypes";

import {publishEvent} from "@src/aws/eventbridge/PublishEvent";

interface PublishKycRejectedOptions {
  client: EventBridgeClient;
  eventBusName: string;
  detail: KycRejectedEventDetail;
}

export function publishKycRejected({client, eventBusName, detail}: PublishKycRejectedOptions): Promise<void> {
  return publishEvent({client, eventBusName, detailType: KYC_DETAIL_TYPES.rejected, detail});
}
