import {KYC_REJECTION_REASONS} from "@ledger/shared/kyc/KycRejectionReason";

import type {KycDecision} from "./types/KycDecision";
import type {StoredKycDecision} from "./types/StoredKycDecision";

// For what an adapter reads back from storage: a decision the ledger does not recognise is a fault to surface.
export function parseKycDecision({outcome, reason}: StoredKycDecision): KycDecision {
  if (outcome === "passed") {
    return {outcome: "passed"};
  }
  if (outcome !== "rejected") {
    throw new Error(`Unknown KYC outcome: ${outcome}`);
  }
  const knownReason = KYC_REJECTION_REASONS.find(known => known === reason);
  if (knownReason === undefined) {
    throw new Error(`Unknown KYC rejection reason: ${reason}`);
  }
  return {outcome: "rejected", reason: knownReason};
}
