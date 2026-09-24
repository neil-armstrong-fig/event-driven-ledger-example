import type {AnonymousRequest} from "@src/dsl/ledger/components/requests/types/AnonymousRequest";

export interface FractionalizationRequest extends AnonymousRequest {
  customerId: string;
}
