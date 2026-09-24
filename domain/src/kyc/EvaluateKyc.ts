import type {KycDecision} from "./types/KycDecision";
import type {KycStatusRecord} from "./types/KycStatusRecord";

interface EvaluateKycOptions {
  status: KycStatusRecord | undefined;
  now: Date;
}

// The decision table in docs/decisions/0003-kyc-gating.md. `now` is passed in, so expiry needs no waiting.
export function evaluateKyc({status, now}: EvaluateKycOptions): KycDecision {
  if (status?.status === "pending") {
    return {outcome: "rejected", reason: "pending"};
  }
  if (status?.status !== "verified") {
    return {outcome: "rejected", reason: "not-verified"};
  }
  if (status.expiresAt !== undefined && Date.parse(status.expiresAt) <= now.getTime()) {
    return {outcome: "rejected", reason: "expired"};
  }
  return {outcome: "passed"};
}
