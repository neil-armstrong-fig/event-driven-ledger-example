import {DslError} from "@src/dsl/errors/DslError";
import {KycClient} from "@src/dsl/ledger/components/kyc/aws/KycClient";
import type {CustomerKyc} from "@src/dsl/ledger/components/kyc/types/CustomerKyc";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** What the ledger knows about its customers' KYC, reached as `ledger.kyc`. */
export class KycDsl {
  private readonly kyc: KycClient;

  constructor(endpoints: LedgerEndpoints) {
    this.kyc = new KycClient(endpoints);
  }

  /** Puts the customer's KYC status in the ledger, standing in for the KYC provider's feed (docs/decisions/0003-kyc-gating.md). */
  async seedCustomer(customer: CustomerKyc): Promise<void> {
    try {
      await this.kyc.seedCustomer(customer);
    } catch (error) {
      throw new DslError(`Failed to seed the KYC status ${DslError.describe(customer)}`, error);
    }
  }
}
