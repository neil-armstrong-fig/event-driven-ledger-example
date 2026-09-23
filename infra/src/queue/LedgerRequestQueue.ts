import {Queue} from "aws-cdk-lib/aws-sqs";
import {Construct} from "constructs";

const MAX_RECEIVE_COUNT = 3;

export class LedgerRequestQueue extends Construct {
  public readonly queue: Queue;
  public readonly deadLetterQueue: Queue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.deadLetterQueue = new Queue(this, "DeadLetterQueue", {fifo: true});

    this.queue = new Queue(this, "Queue", {
      fifo: true,
      contentBasedDeduplication: true,
      deadLetterQueue: {queue: this.deadLetterQueue, maxReceiveCount: MAX_RECEIVE_COUNT},
    });
  }
}
