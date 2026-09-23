import {DynamoDBClient, QueryCommand} from "@aws-sdk/client-dynamodb";
import {eventually} from "@src/dsl/shared/polling/Eventually";
import type {KycPassedEvent} from "@src/dsl/ledger/components/events/types/KycPassedEvent";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** Longer than the worker takes to publish once it has recorded, and the rule to store it in the sink. */
const EMITTED_WITHIN = {timeoutMs: 15_000, intervalMs: 250};

/**
 * The event sink table, in which a rule stores every `KYC_PASSED_STUB` under its idempotency key
 * (`infra`'s `LedgerEventSink`). Catches nothing — the `EventsDsl` beside it names what failed.
 *
 * Reading consumes nothing and asking about one key touches nothing else, so it keeps no state and any
 * number of specs can run at once, each seeing only the events for the keys it generated.
 */
export class EventsClient {
  private readonly sinkTableName: string;
  private readonly dynamoDb = new DynamoDBClient({});

  constructor({sinkTableName}: LedgerEndpoints) {
    this.sinkTableName = sinkTableName;
  }

  /** Every event stored for the key so far. */
  async getKycPassedEventsFor(idempotencyKey: string): Promise<KycPassedEvent[]> {
    const {Items = []} = await this.dynamoDb.send(
      new QueryCommand({
        TableName: this.sinkTableName,
        KeyConditionExpression: "idempotencyKey = :key",
        ExpressionAttributeValues: {":key": {S: idempotencyKey}},
        ConsistentRead: true,
      }),
    );
    return Items.map(item => ({assetId: item["assetId"]?.S ?? "", idempotencyKey}));
  }

  /** Polls until at least `atLeast` events for the key were emitted. Rejects if they never are. */
  async waitForKycPassedEvents(idempotencyKey: string, atLeast: number): Promise<void> {
    await eventually(async () => {
      const events = await this.getKycPassedEventsFor(idempotencyKey);
      return events.length >= atLeast ? true : undefined;
    }, EMITTED_WITHIN);
  }
}
