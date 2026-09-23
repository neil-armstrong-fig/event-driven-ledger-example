import {DeleteMessageBatchCommand, ReceiveMessageCommand, SQSClient} from "@aws-sdk/client-sqs";
import {eventually} from "@src/dsl/shared/polling/Eventually";
import {parseKycPassedEvent} from "@src/dsl/ledger/components/events/aws/envelope/ParseKycPassedEvent";
import type {KycPassedEvent} from "@src/dsl/ledger/components/events/types/KycPassedEvent";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

const MAX_BATCH = 10;

/** Longer than the worker takes to publish once it has recorded, and the rule to deliver to the sink. */
const EMITTED_WITHIN = {timeoutMs: 15_000, intervalMs: 250};

/**
 * The EventBridge sink queue. Catches nothing — the `EventsDsl` beside it names what failed.
 *
 * **It is the one counterpart that keeps state.** Reading an SQS queue consumes its messages, and
 * there is no way to ask "was this emitted" without doing so, so what has been read is kept here and
 * every question is answered from it. One instance per spec, which `LedgerDsl` being built per spec
 * already gives.
 */
export class EventsClient {
  private readonly sinkQueueUrl: string;
  // The queue URL LocalStack hands back names its own host, not the endpoint the client was configured
  // with — use the configured one rather than warn on every call.
  private readonly sqs = new SQSClient({useQueueUrlAsEndpoint: false});
  private readonly seen: KycPassedEvent[] = [];

  constructor({sinkQueueUrl}: LedgerEndpoints) {
    this.sinkQueueUrl = sinkQueueUrl;
  }

  /** Reads what is on the queue now, and returns every event for the key seen so far. */
  async getKycPassedEventsFor(idempotencyKey: string): Promise<KycPassedEvent[]> {
    await this.drainSinkQueue();
    return this.seen.filter(event => event.idempotencyKey === idempotencyKey);
  }

  /** Polls until at least `atLeast` events for the key were emitted. Rejects if they never are. */
  async waitForKycPassedEvents(idempotencyKey: string, atLeast: number): Promise<void> {
    await eventually(async () => {
      const events = await this.getKycPassedEventsFor(idempotencyKey);
      return events.length >= atLeast ? true : undefined;
    }, EMITTED_WITHIN);
  }

  private async drainSinkQueue(): Promise<void> {
    for (;;) {
      const {Messages = []} = await this.sqs.send(
        new ReceiveMessageCommand({QueueUrl: this.sinkQueueUrl, MaxNumberOfMessages: MAX_BATCH, WaitTimeSeconds: 1}),
      );
      if (Messages.length === 0) return;

      await this.sqs.send(
        new DeleteMessageBatchCommand({
          QueueUrl: this.sinkQueueUrl,
          Entries: Messages.map(({MessageId, ReceiptHandle}) => ({Id: MessageId, ReceiptHandle})),
        }),
      );
      for (const {Body} of Messages) {
        const event = Body === undefined ? undefined : parseKycPassedEvent(Body);
        if (event !== undefined) this.seen.push(event);
      }
    }
  }
}
