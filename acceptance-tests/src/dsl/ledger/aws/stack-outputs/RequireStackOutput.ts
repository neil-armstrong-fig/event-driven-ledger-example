import type {StackOutputs} from "@src/dsl/ledger/aws/stack-outputs/StackOutputs";

export function requireStackOutput(outputs: StackOutputs, key: string): string {
  const value = outputs[key];
  if (value === undefined) {
    throw new Error(`Stack output ${key} not found (have: ${Object.keys(outputs).join(", ") || "none"})`);
  }
  return value;
}
