import {Rule} from "aws-cdk-lib/aws-events";
import type {EventBus} from "aws-cdk-lib/aws-events";
import {SqsQueue} from "aws-cdk-lib/aws-events-targets";
import {Queue} from "aws-cdk-lib/aws-sqs";
import {Construct} from "constructs";

const KYC_PASSED_DETAIL_TYPE = "KYC_PASSED_STUB";

interface LedgerEventSinkProps {
  readonly bus: EventBus;
}

/**
 * A test-only listener: there is no way to ask EventBridge "was this emitted", so a rule delivers
 * every `KYC_PASSED_STUB` to a queue the acceptance tests can read (docs/PLAN.md Phase 1 results,
 * item 6). Mounted only behind the `includeEventSink` context flag — see `LedgerStack`.
 * `SqsQueue` adds the queue policy that lets `events.amazonaws.com` send to it.
 */
export class LedgerEventSink extends Construct {
  public readonly queue: Queue;

  constructor(scope: Construct, id: string, {bus}: LedgerEventSinkProps) {
    super(scope, id);

    this.queue = new Queue(this, "Queue");

    new Rule(this, "KycPassedRule", {
      eventBus: bus,
      eventPattern: {detailType: [KYC_PASSED_DETAIL_TYPE]},
      targets: [new SqsQueue(this.queue)],
    });
  }
}
