import {FRACTIONALIZATION_REQUESTS_PATH} from "@ledger/shared/api/FractionalizationRequestsPath";
import type {FractionalizationRequest} from "@src/dsl/ledger/components/requests/types/FractionalizationRequest";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** The API in front of the ledger. Catches nothing — the `RequestsDsl` beside it names what failed. */
export class RequestsClient {
  private readonly apiUrl: string;

  constructor({apiUrl}: LedgerEndpoints) {
    this.apiUrl = apiUrl;
  }

  /** The HTTP status the API answered with, so a rejection can be asserted on as readily as an acceptance. */
  async submit({idempotencyKey, assetId, requestId}: FractionalizationRequest): Promise<number> {
    const response = await fetch(new URL(FRACTIONALIZATION_REQUESTS_PATH, this.apiUrl), {
      method: "POST",
      headers: {"Content-Type": "application/json", "Idempotency-Key": idempotencyKey},
      body: JSON.stringify({assetId, requestId}),
    });
    return response.status;
  }
}
