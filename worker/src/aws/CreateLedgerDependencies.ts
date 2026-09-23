import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {EventBridgeClient} from "@aws-sdk/client-eventbridge";

import {recordRequest} from "@src/aws/dynamodb/RecordRequest";
import {publishKycPassed} from "@src/aws/eventbridge/PublishKycPassed";
import type {LedgerBatchDependencies} from "@src/batch/types/LedgerBatchDependencies";

interface LedgerResourceNames {
  tableName: string;
  eventBusName: string;
}

export function createLedgerDependencies({tableName, eventBusName}: LedgerResourceNames): LedgerBatchDependencies {
  const dynamoDb = new DynamoDBClient({});
  const eventBridge = new EventBridgeClient({});

  return {
    recordRequest: idempotencyKey => recordRequest({client: dynamoDb, tableName, idempotencyKey}),
    publishKycPassed: detail => publishKycPassed({client: eventBridge, eventBusName, detail}),
  };
}
