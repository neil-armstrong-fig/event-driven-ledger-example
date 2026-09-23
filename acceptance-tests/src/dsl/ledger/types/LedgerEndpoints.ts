import type {LedgerStackOutputKey} from "@ledger/shared/stack/LedgerStackOutputKey";

/**
 * Where a deployed ledger stack's pieces live — resolved once per file from its stack outputs. One
 * entry per output `infra` declares (`apiUrl`, `tableName`, `sinkTableName`), derived from
 * `LEDGER_STACK_OUTPUTS` so it cannot list one the stack does not provide.
 */
export type LedgerEndpoints = Record<LedgerStackOutputKey, string>;
