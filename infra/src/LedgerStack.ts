import {Stack, type StackProps} from "aws-cdk-lib";
import type {Construct} from "constructs";

import {LedgerApi} from "@src/api/LedgerApi";
import {LedgerEventBus} from "@src/events/LedgerEventBus";
import {LedgerIdempotencyTable} from "@src/idempotency/LedgerIdempotencyTable";
import {LedgerRequestQueue} from "@src/queue/LedgerRequestQueue";
import {LedgerWorker} from "@src/worker/LedgerWorker";

export class LedgerStack extends Stack {
  public readonly requestQueue: LedgerRequestQueue;
  public readonly idempotencyTable: LedgerIdempotencyTable;
  public readonly eventBus: LedgerEventBus;
  public readonly api: LedgerApi;
  public readonly worker: LedgerWorker;

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
  }
}
