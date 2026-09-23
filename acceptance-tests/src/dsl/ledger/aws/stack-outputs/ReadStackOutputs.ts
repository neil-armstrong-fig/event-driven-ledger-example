import {CloudFormationClient, DescribeStacksCommand} from "@aws-sdk/client-cloudformation";
import type {StackOutputs} from "@src/dsl/ledger/aws/stack-outputs/StackOutputs";

/** Reads a deployed stack's outputs — the outputs `LedgerStack` declares for these specs. */
export async function readStackOutputs(stackName: string): Promise<StackOutputs> {
  const {Stacks} = await new CloudFormationClient({}).send(new DescribeStacksCommand({StackName: stackName}));

  const outputs: StackOutputs = {};
  for (const {OutputKey, OutputValue} of Stacks?.[0]?.Outputs ?? []) {
    if (OutputKey !== undefined && OutputValue !== undefined) outputs[OutputKey] = OutputValue;
  }
  return outputs;
}
