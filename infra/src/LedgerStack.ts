import {CfnOutput, Stack, type StackProps} from "aws-cdk-lib";
import {LEDGER_STACK_OUTPUTS} from "@ledger/shared/stack/LedgerStackOutputs";
import type {Construct} from "constructs";

import {LedgerApi} from "@src/api/LedgerApi";
import {LedgerEventBus} from "@src/events/LedgerEventBus";
import {LedgerEventSink} from "@src/events/LedgerEventSink";
import {LedgerIdempotencyTable} from "@src/idempotency/LedgerIdempotencyTable";
import {LedgerRequestQueue} from "@src/queue/LedgerRequestQueue";
import {LedgerWorker} from "@src/worker/LedgerWorker";

export class LedgerStack extends Stack {
  public readonly requestQueue: LedgerRequestQueue;
  public readonly idempotencyTable: LedgerIdempotencyTable;
  public readonly eventBus: LedgerEventBus;
  public readonly api: LedgerApi;
  public readonly worker: LedgerWorker;
  /** Only present when the `includeEventSink` context flag is set — acceptance tests, never a real deployment. */
  public readonly eventSink?: LedgerEventSink;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.requestQueue = new LedgerRequestQueue(this, "RequestQueue");
    this.idempotencyTable = new LedgerIdempotencyTable(this, "IdempotencyTable");
    this.eventBus = new LedgerEventBus(this, "EventBus");
    this.api = new LedgerApi(this, "Api", {queue: this.requestQueue.queue});
    this.worker = new LedgerWorker(this, "Worker", {
      queue: this.requestQueue.queue,
      table: this.idempotencyTable.table,
      eventBus: this.eventBus.bus,
    });

    if (isSet(this.node.tryGetContext("includeEventSink"))) {
      this.eventSink = new LedgerEventSink(this, "EventSink", {bus: this.eventBus.bus});
      new CfnOutput(this, LEDGER_STACK_OUTPUTS.sinkQueueUrl, {value: this.eventSink.queue.queueUrl});
    }

    // Read by acceptance-tests (aws/stack/ReadStackOutputs.ts) to find the deployed resources.
    new CfnOutput(this, LEDGER_STACK_OUTPUTS.apiUrl, {value: this.api.restApi.url});
    new CfnOutput(this, LEDGER_STACK_OUTPUTS.tableName, {value: this.idempotencyTable.table.tableName});
  }
}

/** CDK context from `-c includeEventSink=true` arrives as the string "true". */
function isSet(flag: unknown): boolean {
  return flag === true || flag === "true";
}
