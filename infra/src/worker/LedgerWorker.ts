import path from "node:path";

import {Duration} from "aws-cdk-lib";
import type {ITable} from "aws-cdk-lib/aws-dynamodb";
import type {IEventBus} from "aws-cdk-lib/aws-events";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {SqsEventSource} from "aws-cdk-lib/aws-lambda-event-sources";
import type {IQueue} from "aws-cdk-lib/aws-sqs";
import {Construct} from "constructs";

import {findWorkspaceRoot} from "@src/worker/workspace/FindWorkspaceRoot";

const WORKER_ENTRY = path.join(findWorkspaceRoot(import.meta.dirname), "worker/src/HandleLedgerBatch.ts");
const BATCH_SIZE = 5;

interface LedgerWorkerProps {
  queue: IQueue;
  table: ITable;
  kycTable: ITable;
  eventBus: IEventBus;
}

export class LedgerWorker extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, {queue, table, kycTable, eventBus}: LedgerWorkerProps) {
    super(scope, id);

    // Bundled from the worker's source by esbuild at synth — infra never imports it in TypeScript.
    this.function = new NodejsFunction(this, "Function", {
      entry: WORKER_ENTRY,
      handler: "handleLedgerBatch",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(30),
      environment: {
        LEDGER_TABLE_NAME: table.tableName,
        LEDGER_KYC_TABLE_NAME: kycTable.tableName,
        LEDGER_EVENT_BUS_NAME: eventBus.eventBusName,
      },
    });

    // Least privilege: the worker only ever conditionally puts one item (a failed condition hands back the
    // original), so not grantWriteData (which would also allow update/delete/batch-write).
    table.grant(this.function, "dynamodb:PutItem");
    // It only ever reads KYC status. It must not be able to write it: a worker that could would be able to
    // make a customer verified (docs/decisions/0003-kyc-gating.md).
    kycTable.grant(this.function, "dynamodb:GetItem");
    eventBus.grantPutEventsTo(this.function);

    // reportBatchItemFailures lets the worker fail individual messages instead of the whole batch.
    this.function.addEventSource(new SqsEventSource(queue, {batchSize: BATCH_SIZE, reportBatchItemFailures: true}));
  }
}
