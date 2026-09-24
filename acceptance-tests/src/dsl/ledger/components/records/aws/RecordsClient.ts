import {DynamoDBClient, GetItemCommand, type AttributeValue} from "@aws-sdk/client-dynamodb";
import type {KycOutcome} from "@ledger/shared/kyc/KycOutcome";
import type {KycRejectionReason} from "@ledger/shared/kyc/KycRejectionReason";
import type {KycStatus} from "@ledger/shared/kyc/KycStatus";
import type {RecordedRequest} from "@src/dsl/ledger/components/records/types/RecordedRequest";
import {eventually} from "@src/dsl/shared/polling/Eventually";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** Longer than the worker takes to pick up a message and write it, on a LocalStack that is already warm. */
const RECORDED_WITHIN = {timeoutMs: 15_000, intervalMs: 250};

/** The idempotency table. Catches nothing — the `RecordsDsl` beside it names what failed. */
export class RecordsClient {
  private readonly tableName: string;
  private readonly dynamoDb = new DynamoDBClient({});

  constructor({tableName}: LedgerEndpoints) {
    this.tableName = tableName;
  }

  /** The table is keyed on `idempotencyKey` alone, so there is at most one record per key. */
  async isRecorded(idempotencyKey: string): Promise<boolean> {
    const {Item} = await this.dynamoDb.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: {idempotencyKey: {S: idempotencyKey}},
        ConsistentRead: true,
      }),
    );
    return Item !== undefined;
  }

  /** The decision on record for this key and what it rested on, or `undefined` when nothing is recorded yet. */
  async getRecordedRequestFor(idempotencyKey: string): Promise<RecordedRequest | undefined> {
    const {Item} = await this.dynamoDb.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: {idempotencyKey: {S: idempotencyKey}},
        ConsistentRead: true,
      }),
    );
    if (Item === undefined) {
      return undefined;
    }
    return toRecordedRequest(Item);
  }

  /** Polls rather than sleeping — see `eventually`. Rejects if the record never appears. */
  async waitForRecord(idempotencyKey: string): Promise<void> {
    await eventually(async () => {
      if (await this.isRecorded(idempotencyKey)) {
        return true;
      }
      return undefined;
    }, RECORDED_WITHIN);
  }
}

function toRecordedRequest(item: Record<string, AttributeValue>): RecordedRequest {
  return {
    customerId: item["customerId"]?.S ?? "",
    assetId: item["assetId"]?.S ?? "",
    outcome: item["outcome"]?.S as KycOutcome,
    reason: item["reason"]?.S as KycRejectionReason | undefined,
    kycStatus: item["kycStatus"]?.S as KycStatus | undefined,
    decidedAt: item["decidedAt"]?.S ?? "",
  };
}
