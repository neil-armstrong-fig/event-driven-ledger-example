import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {EventBridgeClient} from "@aws-sdk/client-eventbridge";

import {getKycStatus} from "@src/aws/dynamodb/GetKycStatus";
import {recordRequest} from "@src/aws/dynamodb/RecordRequest";
import {publishKycPassed} from "@src/aws/eventbridge/PublishKycPassed";
import {publishKycRejected} from "@src/aws/eventbridge/PublishKycRejected";
import type {LedgerBatchDependencies} from "@src/batch/types/LedgerBatchDependencies";

interface LedgerResourceNames {
  tableName: string;
  kycTableName: string;
  eventBusName: string;
}

export function createLedgerDependencies({
  tableName,
  kycTableName,
  eventBusName,
}: LedgerResourceNames): LedgerBatchDependencies {
  const dynamoDb = new DynamoDBClient({});
  const eventBridge = new EventBridgeClient({});

  return {
    getKycStatus: customerId => getKycStatus({client: dynamoDb, tableName: kycTableName, customerId}),
    now: () => new Date(),
    recordRequest: request => recordRequest({client: dynamoDb, tableName, request}),
    publishKycPassed: detail => publishKycPassed({client: eventBridge, eventBusName, detail}),
    publishKycRejected: detail => publishKycRejected({client: eventBridge, eventBusName, detail}),
  };
}
