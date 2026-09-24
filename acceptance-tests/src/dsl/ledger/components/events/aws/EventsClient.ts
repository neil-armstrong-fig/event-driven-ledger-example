import {DynamoDBClient, QueryCommand} from "@aws-sdk/client-dynamodb";
import {KYC_DETAIL_TYPES} from "@ledger/shared/events/KycDetailTypes";
import {eventually} from "@src/dsl/shared/polling/Eventually";
import type {KycPassedEvent} from "@src/dsl/ledger/components/events/types/KycPassedEvent";
import type {KycRejectedEvent} from "@src/dsl/ledger/components/events/types/KycRejectedEvent";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** Longer than the worker takes to publish once it has recorded, and the rule to store it in the sink. */
const EMITTED_WITHIN = {timeoutMs: 15_000, intervalMs: 250};

/**
 * The event sink table, in which a rule stores every `KYC_PASSED` and `KYC_REJECTED` under its idempotency
 * key (`infra`'s `LedgerEventSink`), with the event's whole `detail` as JSON. Catches nothing — the
 * `EventsDsl` beside it names what failed.
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

  /** Every `KYC_PASSED` stored for the key so far. */
  getKycPassedEventsFor(idempotencyKey: string): Promise<KycPassedEvent[]> {
    return this.getEventsFor<KycPassedEvent>(idempotencyKey, KYC_DETAIL_TYPES.passed);
  }

  /** Every `KYC_REJECTED` stored for the key so far. */
  getKycRejectedEventsFor(idempotencyKey: string): Promise<KycRejectedEvent[]> {
    return this.getEventsFor<KycRejectedEvent>(idempotencyKey, KYC_DETAIL_TYPES.rejected);
  }

  /** Polls until at least `atLeast` `KYC_PASSED` events for the key were emitted. Rejects if they never are. */
  waitForKycPassedEvents(idempotencyKey: string, atLeast: number): Promise<void> {
    return this.waitForEvents(idempotencyKey, KYC_DETAIL_TYPES.passed, atLeast);
  }

  /** Polls until at least `atLeast` `KYC_REJECTED` events for the key were emitted. Rejects if they never are. */
  waitForKycRejectedEvents(idempotencyKey: string, atLeast: number): Promise<void> {
    return this.waitForEvents(idempotencyKey, KYC_DETAIL_TYPES.rejected, atLeast);
  }

  private async getEventsFor<Event>(idempotencyKey: string, detailType: string): Promise<Event[]> {
    const {Items = []} = await this.dynamoDb.send(
      new QueryCommand({
        TableName: this.sinkTableName,
        KeyConditionExpression: "idempotencyKey = :key",
        FilterExpression: "detailType = :type",
        ExpressionAttributeValues: {":key": {S: idempotencyKey}, ":type": {S: detailType}},
        ConsistentRead: true,
      }),
    );
    return Items.map(item => JSON.parse(item["detail"]?.S ?? "{}") as Event);
  }

  private async waitForEvents(idempotencyKey: string, detailType: string, atLeast: number): Promise<void> {
    await eventually(async () => {
      const events = await this.getEventsFor<object>(idempotencyKey, detailType);
      if (events.length >= atLeast) {
        return true;
      }
      return undefined;
    }, EMITTED_WITHIN);
  }
}
