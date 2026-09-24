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

it("keys the idempotency table on the customer and their idempotency key", () => {
  const stack = new Stack(new App(), "TestStack");
  new LedgerIdempotencyTable(stack, "IdempotencyTable");

  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: [
      {AttributeName: "customerId", KeyType: "HASH"},
      {AttributeName: "idempotencyKey", KeyType: "RANGE"},
    ],
  });
});
