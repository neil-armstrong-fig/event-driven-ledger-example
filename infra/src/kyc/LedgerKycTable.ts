import {RemovalPolicy} from "aws-cdk-lib";
import {AttributeType, BillingMode, Table} from "aws-cdk-lib/aws-dynamodb";
import {Construct} from "constructs";

/**
 * The ledger's own record of each customer's KYC status (docs/decisions/0003-kyc-gating.md): the outcome
 * the KYC provider reached, never the documents behind it. The worker reads it and cannot write to it.
 * Nothing in this stack fills it — in a real deployment the provider's feed would, and until then the
 * acceptance tests seed it.
 */
export class LedgerKycTable extends Construct {
  public readonly table: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new Table(this, "Table", {
      partitionKey: {name: "customerId", type: AttributeType.STRING},
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
