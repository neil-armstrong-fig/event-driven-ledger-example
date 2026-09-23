import {App, Stack} from "aws-cdk-lib";
import {Template} from "aws-cdk-lib/assertions";
import {Queue} from "aws-cdk-lib/aws-sqs";
import {FRACTIONALIZATION_REQUESTS_PATH} from "@ledger/shared/api/FractionalizationRequestsPath";

import {LedgerApi} from "@src/api/LedgerApi";

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

it("serves fractionalization requests at the path the acceptance tests post to", () => {
  const stack = new Stack(new App(), "TestStack");
  const queue = new Queue(stack, "Queue", {fifo: true});
  new LedgerApi(stack, "Api", {queue});

  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::ApiGateway::Resource", {PathPart: FRACTIONALIZATION_REQUESTS_PATH});
});
