import type {LEDGER_STACK_OUTPUTS} from "./LedgerStackOutputs";

/** A key of `LEDGER_STACK_OUTPUTS` — what a spec calls an endpoint, as opposed to its output name. */
export type LedgerStackOutputKey = keyof typeof LEDGER_STACK_OUTPUTS;
