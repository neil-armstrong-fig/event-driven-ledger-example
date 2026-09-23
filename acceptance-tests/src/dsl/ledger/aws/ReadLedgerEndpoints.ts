import type {LedgerStackOutputKey} from "@ledger/shared/stack/LedgerStackOutputKey";
import {LEDGER_STACK_OUTPUTS} from "@ledger/shared/stack/LedgerStackOutputs";
import {readStackOutputs} from "@src/dsl/ledger/aws/stack-outputs/ReadStackOutputs";
import {requireStackOutput} from "@src/dsl/ledger/aws/stack-outputs/RequireStackOutput";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** Reads every output in `LEDGER_STACK_OUTPUTS` — looping over it, not listing them, so none can be missed. */
export async function readLedgerEndpoints(stackName: string): Promise<LedgerEndpoints> {
  const outputs = await readStackOutputs(stackName);

  const keys = Object.keys(LEDGER_STACK_OUTPUTS) as LedgerStackOutputKey[];
  return Object.fromEntries(
    keys.map(key => [key, requireStackOutput(outputs, LEDGER_STACK_OUTPUTS[key])]),
  ) as LedgerEndpoints;
}
