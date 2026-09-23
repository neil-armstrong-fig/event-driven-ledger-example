import {App, Stack} from "aws-cdk-lib";
import {Template} from "aws-cdk-lib/assertions";

import {LedgerIdempotencyTable} from "@src/idempotency/LedgerIdempotencyTable";

it("destroys the idempotency table on stack teardown instead of retaining it", () => {
  const stack = new Stack(new App(), "TestStack");
  new LedgerIdempotencyTable(stack, "IdempotencyTable");

  const template = Template.fromStack(stack);

  template.hasResource("AWS::DynamoDB::Table", {
    DeletionPolicy: "Delete",
    UpdateReplacePolicy: "Delete",
  });
});
