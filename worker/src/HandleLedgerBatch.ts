interface LedgerBatchResponse {
  batchItemFailures: {itemIdentifier: string}[];
}

// Placeholder so infra's NodejsFunction has a real entry to bundle (Phase 4 step 5). Phase 5
// replaces this, test-first, with the real handler.
export function handleLedgerBatch(): Promise<LedgerBatchResponse> {
  return Promise.resolve({batchItemFailures: []});
}
