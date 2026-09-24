import {
  ConditionalCheckFailedException,
  PutItemCommand,
  type AttributeValue,
  type DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {parseKycDecision} from "@ledger/domain/kyc/ParseKycDecision";
import {parseKycStatus} from "@ledger/domain/kyc/ParseKycStatus";

import {requireStringAttribute} from "@src/aws/dynamodb/RequireStringAttribute";
import type {RequestRecord} from "@src/batch/types/RequestRecord";

interface RecordRequestOptions {
  client: DynamoDBClient;
  tableName: string;
  request: RequestRecord;
}

type Item = Record<string, AttributeValue>;

/** Resolves to what is now on file for the key: `request` if it was new, otherwise the original, untouched. */
export async function recordRequest({client, tableName, request}: RecordRequestOptions): Promise<RequestRecord> {
  try {
    // The idempotency guard itself (docs/decisions/0001-dedup-vs-idempotency.md).
    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: toItem(request),
        ConditionExpression: "attribute_not_exists(idempotencyKey)",
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      }),
    );
    return request;
  } catch (error) {
    if (!(error instanceof ConditionalCheckFailedException)) {
      throw error;
    }
    // `ReturnValuesOnConditionCheckFailure: "ALL_OLD"` hands the original back, so no second read is needed.
    if (error.Item === undefined) {
      throw new Error(`Idempotency key ${request.idempotencyKey} already exists, but the store did not return it`, {
        cause: error,
      });
    }
    return toRequestRecord(error.Item);
  }
}

function toItem({idempotencyKey, customerId, assetId, decision, kycStatus, decidedAt}: RequestRecord): Item {
  return {
    idempotencyKey: {S: idempotencyKey},
    customerId: {S: customerId},
    assetId: {S: assetId},
    outcome: {S: decision.outcome},
    ...(decision.outcome === "rejected" && {reason: {S: decision.reason}}),
    ...(kycStatus && {kycStatus: {S: kycStatus}}),
    decidedAt: {S: decidedAt},
  };
}

function toRequestRecord(item: Item): RequestRecord {
  const kycStatus = item["kycStatus"]?.S;
  const reason = item["reason"]?.S;

  return {
    idempotencyKey: requireStringAttribute(item, "idempotencyKey"),
    customerId: requireStringAttribute(item, "customerId"),
    assetId: requireStringAttribute(item, "assetId"),
    decision: parseKycDecision({outcome: requireStringAttribute(item, "outcome"), ...(reason && {reason})}),
    ...(kycStatus && {kycStatus: parseKycStatus(kycStatus)}),
    decidedAt: requireStringAttribute(item, "decidedAt"),
  };
}
