import {DslError} from "@src/dsl/errors/DslError";
import {RequestsClient} from "@src/dsl/ledger/components/requests/aws/RequestsClient";
import type {FractionalizationRequest} from "@src/dsl/ledger/components/requests/types/FractionalizationRequest";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** The requests a client sends the ledger, reached as `ledger.requests`. */
export class RequestsDsl {
  private readonly requests: RequestsClient;

  constructor(endpoints: LedgerEndpoints) {
    this.requests = new RequestsClient(endpoints);
  }

  /** Sends the request and returns the HTTP status the API answered with. */
  async submit(request: FractionalizationRequest): Promise<number> {
    try {
      return await this.requests.submit(request);
    } catch (error) {
      throw new DslError(`Failed to submit a fractionalization request ${DslError.describe(request)}`, error);
    }
  }
}
