import {Stack} from "aws-cdk-lib";
import {AwsIntegration, PassthroughBehavior, RestApi, type JsonSchema} from "aws-cdk-lib/aws-apigateway";
import {Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import type {Queue} from "aws-cdk-lib/aws-sqs";
import {Construct} from "constructs";

import {LEDGER_REQUEST_SCHEMA} from "@ledger/shared/events/LedgerRequestSchema";

import {LEDGER_API_REQUEST_TEMPLATE} from "@src/api/request/LedgerApiRequestTemplate";

export interface LedgerApiProps {
  readonly queue: Queue;
}

export class LedgerApi extends Construct {
  public readonly restApi: RestApi;

  constructor(scope: Construct, id: string, props: LedgerApiProps) {
    super(scope, id);

    const integrationRole = new Role(this, "IntegrationRole", {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });
    props.queue.grantSendMessages(integrationRole);

    this.restApi = new RestApi(this, "RestApi", {cloudWatchRole: false});

    const model = this.restApi.addModel("FractionalizationRequestModel", {
      contentType: "application/json",
      schema: LEDGER_REQUEST_SCHEMA as JsonSchema,
    });

    const validator = this.restApi.addRequestValidator("RequestValidator", {
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    const integration = new AwsIntegration({
      service: "sqs",
      path: `${Stack.of(this).account}/${props.queue.queueName}`,
      integrationHttpMethod: "POST",
      options: {
        credentialsRole: integrationRole,
        passthroughBehavior: PassthroughBehavior.NEVER,
        requestParameters: {
          "integration.request.header.Content-Type": "'application/x-www-form-urlencoded'",
        },
        requestTemplates: {
          "application/json": LEDGER_API_REQUEST_TEMPLATE,
        },
        integrationResponses: [
          {
            statusCode: "202",
            selectionPattern: "2\\d{2}",
            responseTemplates: {"application/json": JSON.stringify({message: "Accepted"})},
          },
          {
            statusCode: "500",
            responseTemplates: {"application/json": JSON.stringify({message: "Failed to enqueue the request"})},
          },
        ],
      },
    });

    const requestsResource = this.restApi.root.addResource("fractionalization-requests");
    requestsResource.addMethod("POST", integration, {
      requestValidator: validator,
      requestModels: {"application/json": model},
      requestParameters: {"method.request.header.Idempotency-Key": true},
      methodResponses: [{statusCode: "202"}, {statusCode: "500"}],
    });
  }
}
