import {GetItemCommand, type DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {parseKycStatus} from "@ledger/domain/kyc/ParseKycStatus";
import type {KycStatusRecord} from "@ledger/domain/kyc/types/KycStatusRecord";

import {requireStringAttribute} from "@src/aws/dynamodb/RequireStringAttribute";

interface GetKycStatusOptions {
  client: DynamoDBClient;
  tableName: string;
  customerId: string;
}

export async function getKycStatus({
  client,
  tableName,
  customerId,
}: GetKycStatusOptions): Promise<KycStatusRecord | undefined> {
  // Strongly consistent, and never cached in the Lambda: a revocation must count on the very next request
  // (docs/decisions/0003-kyc-gating.md).
  const {Item} = await client.send(
    new GetItemCommand({TableName: tableName, Key: {customerId: {S: customerId}}, ConsistentRead: true}),
  );
  if (Item === undefined) {
    return undefined;
  }

  const expiresAt = Item["expiresAt"]?.S;
  return {status: parseKycStatus(requireStringAttribute(Item, "status")), ...(expiresAt && {expiresAt})};
}
