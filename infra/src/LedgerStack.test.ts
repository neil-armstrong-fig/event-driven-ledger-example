import {App} from "aws-cdk-lib";
import {Template} from "aws-cdk-lib/assertions";

import {LedgerStack} from "./LedgerStack";

it("synthesizes the ledger stack with no unnoticed resource or property changes", () => {
  const stack = new LedgerStack(new App(), "LedgerStack");

  const template = Template.fromStack(stack).toJSON();

  expect(template).toMatchSnapshot();
});
