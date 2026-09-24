import {FRACTIONALIZATION_REQUESTS_PATH} from "@ledger/shared/api/FractionalizationRequestsPath";
import type {AnonymousRequest} from "@src/dsl/ledger/components/requests/types/AnonymousRequest";
import type {FractionalizationRequest} from "@src/dsl/ledger/components/requests/types/FractionalizationRequest";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** The API in front of the ledger. Catches nothing — the `RequestsDsl` beside it names what failed. */
export class RequestsClient {
  private readonly apiUrl: string;

  constructor({apiUrl}: LedgerEndpoints) {
    this.apiUrl = apiUrl;
  }

  /**
   * The HTTP status the API answered with, so a rejection can be asserted on as readily as an acceptance.
   * `Customer-Id` stands in for the identity a real authoriser would supply (docs/decisions/0003-kyc-gating.md).
   */
  submit({customerId, ...request}: FractionalizationRequest): Promise<number> {
    return this.post(request, {"Customer-Id": customerId});
  }

  /** As `submit`, but without the header that says who it is from. */
  submitWithoutCustomer(request: AnonymousRequest): Promise<number> {
    return this.post(request, {});
  }

  private async post({idempotencyKey, assetId, requestId}: AnonymousRequest, identity: object): Promise<number> {
    const response = await fetch(new URL(FRACTIONALIZATION_REQUESTS_PATH, this.apiUrl), {
      method: "POST",
      headers: {"Content-Type": "application/json", "Idempotency-Key": idempotencyKey, ...identity},
      body: JSON.stringify({assetId, requestId}),
    });
    return response.status;
  }
}
