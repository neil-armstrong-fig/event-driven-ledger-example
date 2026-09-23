import {RemovalPolicy} from "aws-cdk-lib";
import {AttributeType, BillingMode, Table} from "aws-cdk-lib/aws-dynamodb";
import {Rule} from "aws-cdk-lib/aws-events";
import type {EventBus} from "aws-cdk-lib/aws-events";
import {SfnStateMachine} from "aws-cdk-lib/aws-events-targets";
import {DefinitionBody, JsonPath, StateMachine, StateMachineType} from "aws-cdk-lib/aws-stepfunctions";
import {DynamoAttributeValue, DynamoPutItem} from "aws-cdk-lib/aws-stepfunctions-tasks";
import {Construct} from "constructs";

const KYC_PASSED_DETAIL_TYPE = "KYC_PASSED_STUB";

interface LedgerEventSinkProps {
  readonly bus: EventBus;
}

/**
 * A test-only listener: there is no way to ask EventBridge "was this emitted", so a rule stores every
 * `KYC_PASSED_STUB` in a table the acceptance tests can query by idempotency key. Unlike a queue,
 * reading it consumes nothing, so specs running in parallel cannot take each other's events. The rule
 * targets a state machine that does one `PutItem` — no handler code to build or maintain. Mounted
 * only behind the `includeEventSink` context flag — see `LedgerStack`.
 *
 * The sort key is the event's own EventBridge id, so two events for one idempotency key (the
 * at-least-once duplicate, docs/decisions/0002-dual-write.md) are both kept.
 */
export class LedgerEventSink extends Construct {
  public readonly table: Table;

  constructor(scope: Construct, id: string, {bus}: LedgerEventSinkProps) {
    super(scope, id);

    this.table = new Table(this, "Table", {
      partitionKey: {name: "idempotencyKey", type: AttributeType.STRING},
      sortKey: {name: "eventId", type: AttributeType.STRING},
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // The rule passes the whole EventBridge envelope in as the execution input.
    const store = new DynamoPutItem(this, "StoreEvent", {
      table: this.table,
      item: {
        idempotencyKey: DynamoAttributeValue.fromString(JsonPath.stringAt("$.detail.idempotencyKey")),
        eventId: DynamoAttributeValue.fromString(JsonPath.stringAt("$.id")),
        assetId: DynamoAttributeValue.fromString(JsonPath.stringAt("$.detail.assetId")),
      },
    });

    const stateMachine = new StateMachine(this, "StateMachine", {
      stateMachineType: StateMachineType.STANDARD,
      definitionBody: DefinitionBody.fromChainable(store),
    });

    new Rule(this, "KycPassedRule", {
      eventBus: bus,
      eventPattern: {detailType: [KYC_PASSED_DETAIL_TYPE]},
      targets: [new SfnStateMachine(stateMachine)],
    });
  }
}
