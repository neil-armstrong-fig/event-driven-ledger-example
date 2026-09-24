/**
 * The CloudFormation output names `infra`'s `LedgerStack` declares and the acceptance tests read —
 * the one list both sides derive from. Adding a name here adds it to the acceptance tests'
 * `LedgerEndpoints` and makes them read it, and fails `infra`'s tests until the acceptance-test stack
 * provides it, so the two cannot drift apart: a missing output is caught at `pnpm checks` instead of
 * as a failure mid-run. (`sinkTableName` exists only in a stack synthesised with `includeEventSink`.)
 */
export const LEDGER_STACK_OUTPUTS = {
  apiUrl: "LedgerApiUrl",
  tableName: "LedgerTableName",
  kycTableName: "LedgerKycTableName",
  sinkTableName: "LedgerSinkTableName",
} as const;
