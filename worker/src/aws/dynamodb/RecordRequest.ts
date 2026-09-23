import {ConditionalCheckFailedException, PutItemCommand, type DynamoDBClient} from "@aws-sdk/client-dynamodb";

import type {RecordOutcome} from "@src/batch/types/RecordOutcome";

interface RecordRequestOptions {
  client: DynamoDBClient;
  tableName: string;
  idempotencyKey: string;
}

export async function recordRequest({client, tableName, idempotencyKey}: RecordRequestOptions): Promise<RecordOutcome> {
  try {
    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: {idempotencyKey: {S: idempotencyKey}},
        ConditionExpression: "attribute_not_exists(idempotencyKey)",
      }),
    );
    return "recorded";
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return "already-recorded";
    }
    throw error;
  }
}
