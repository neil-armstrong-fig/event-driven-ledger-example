import {DynamoDBClient, PutItemCommand, type AttributeValue} from "@aws-sdk/client-dynamodb";
import type {KycStatus} from "@ledger/shared/kyc/KycStatus";
import type {CustomerKyc} from "@src/dsl/ledger/components/kyc/types/CustomerKyc";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** A verification a spec does not say more about is good for a year — far longer than any run. */
const VERIFIED_FOR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * The ledger's KYC status table (`infra`'s `LedgerKycTable`), which the worker only reads. Nothing in the
 * stack fills it, so a spec does — standing in for the KYC provider's feed (docs/decisions/0003-kyc-gating.md).
 * Catches nothing — the `KycDsl` beside it names what failed.
 */
export class KycClient {
  private readonly kycTableName: string;
  private readonly dynamoDb = new DynamoDBClient({});

  constructor({kycTableName}: LedgerEndpoints) {
    this.kycTableName = kycTableName;
  }

  /** Replaces whatever the table held for the customer, so a spec can move one from pending to verified. */
  async seedCustomer(customer: CustomerKyc): Promise<void> {
    await this.dynamoDb.send(new PutItemCommand({TableName: this.kycTableName, Item: toItem(customer)}));
  }
}

function toItem({customerId, status, expiresAt = defaultExpiry(status)}: CustomerKyc): Record<string, AttributeValue> {
  const item: Record<string, AttributeValue> = {customerId: {S: customerId}, status: {S: status}};
  if (expiresAt) {
    item["expiresAt"] = {S: expiresAt};
  }
  return item;
}

function defaultExpiry(status: KycStatus): string | undefined {
  if (status !== "verified") {
    return undefined;
  }
  return new Date(Date.now() + VERIFIED_FOR_MS).toISOString();
}
