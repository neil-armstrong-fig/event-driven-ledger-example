import path from "node:path";

import {Duration} from "aws-cdk-lib";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {SqsEventSource} from "aws-cdk-lib/aws-lambda-event-sources";
import type {IQueue} from "aws-cdk-lib/aws-sqs";
import {Construct} from "constructs";

import {findWorkspaceRoot} from "./FindWorkspaceRoot";

const WORKER_ENTRY = path.join(findWorkspaceRoot(import.meta.dirname), "worker/src/HandleLedgerBatch.ts");
const BATCH_SIZE = 5;

interface LedgerWorkerProps {
  queue: IQueue;
}

export class LedgerWorker extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, {queue}: LedgerWorkerProps) {
    super(scope, id);

    // Bundled from the worker's source by esbuild at synth — infra never imports it in TypeScript.
    this.function = new NodejsFunction(this, "Function", {
      entry: WORKER_ENTRY,
      handler: "handleLedgerBatch",
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(30),
    });

    // reportBatchItemFailures lets the worker fail individual messages instead of the whole batch.
    this.function.addEventSource(new SqsEventSource(queue, {batchSize: BATCH_SIZE, reportBatchItemFailures: true}));
  }
}
