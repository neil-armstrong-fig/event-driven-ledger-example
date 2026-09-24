/**
 * The EventBridge `detail-type` of each KYC outcome the worker announces (docs/decisions/0003-kyc-gating.md):
 * `worker` publishes them and `infra`'s acceptance-test sink matches them, and neither may import the
 * other, so the names live here where both can read the same ones.
 */
export const KYC_DETAIL_TYPES = {
  passed: "KYC_PASSED",
  rejected: "KYC_REJECTED",
} as const;
