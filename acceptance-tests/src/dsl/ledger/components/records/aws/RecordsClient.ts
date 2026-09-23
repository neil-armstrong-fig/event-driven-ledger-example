import {DynamoDBClient, GetItemCommand} from "@aws-sdk/client-dynamodb";
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

  /** Polls rather than sleeping — see `eventually`. Rejects if the record never appears. */
  async waitForRecord(idempotencyKey: string): Promise<void> {
    await eventually(async () => ((await this.isRecorded(idempotencyKey)) ? true : undefined), RECORDED_WITHIN);
  }
}
