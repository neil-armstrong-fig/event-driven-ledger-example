import {Stack, type StackProps} from "aws-cdk-lib";
import type {Construct} from "constructs";

import {LedgerRequestQueue} from "./queue/LedgerRequestQueue";

export class LedgerStack extends Stack {
  public readonly requestQueue: LedgerRequestQueue;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.requestQueue = new LedgerRequestQueue(this, "RequestQueue");
  }
}
