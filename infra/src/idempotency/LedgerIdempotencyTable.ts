import {RemovalPolicy} from "aws-cdk-lib";
import {AttributeType, BillingMode, Table} from "aws-cdk-lib/aws-dynamodb";
import {Construct} from "constructs";

export class LedgerIdempotencyTable extends Construct {
  public readonly table: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new Table(this, "Table", {
      // A key is only unique per customer (docs/decisions/0004-customer-scoped-idempotency.md).
      partitionKey: {name: "customerId", type: AttributeType.STRING},
      sortKey: {name: "idempotencyKey", type: AttributeType.STRING},
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
