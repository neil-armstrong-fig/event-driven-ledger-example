import {App, Stack} from "aws-cdk-lib";
import {Template} from "aws-cdk-lib/assertions";

import {LedgerKycTable} from "@src/kyc/LedgerKycTable";

it("destroys the KYC status table on stack teardown instead of retaining it", () => {
  const stack = new Stack(new App(), "TestStack");
  new LedgerKycTable(stack, "KycTable");

  const template = Template.fromStack(stack);

  template.hasResource("AWS::DynamoDB::Table", {
    DeletionPolicy: "Delete",
    UpdateReplacePolicy: "Delete",
  });
});

it("keys the KYC status table on the customer", () => {
  const stack = new Stack(new App(), "TestStack");
  new LedgerKycTable(stack, "KycTable");

  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: [{AttributeName: "customerId", KeyType: "HASH"}],
  });
});
