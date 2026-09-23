import {App, Stack} from "aws-cdk-lib";
import {Template} from "aws-cdk-lib/assertions";
import {Queue} from "aws-cdk-lib/aws-sqs";

import {LedgerApi} from "./LedgerApi";

it("requires the Idempotency-Key header on the fractionalization request", () => {
  const stack = new Stack(new App(), "TestStack");
  const queue = new Queue(stack, "Queue", {fifo: true});
  new LedgerApi(stack, "Api", {queue});

  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::ApiGateway::Method", {
    HttpMethod: "POST",
    RequestParameters: {
      "method.request.header.Idempotency-Key": true,
    },
  });
});
