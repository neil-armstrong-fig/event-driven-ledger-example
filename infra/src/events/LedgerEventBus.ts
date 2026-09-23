import {EventBus} from "aws-cdk-lib/aws-events";
import {Construct} from "constructs";

export class LedgerEventBus extends Construct {
  public readonly bus: EventBus;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.bus = new EventBus(this, "Bus");
  }
}
