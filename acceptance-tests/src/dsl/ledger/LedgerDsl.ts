import {EventsDsl} from "@src/dsl/ledger/components/events/EventsDsl";
import {KycDsl} from "@src/dsl/ledger/components/kyc/KycDsl";
import {RecordsDsl} from "@src/dsl/ledger/components/records/RecordsDsl";
import {RequestsDsl} from "@src/dsl/ledger/components/requests/RequestsDsl";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/**
 * The deployed ledger, and the whole of what a spec is handed.
 *
 * Every object in the DSL is a pair: the `*Dsl` here, and the `*Client` beside it in `aws/` that
 * actually talks to the stack. Each `*Dsl` is handed the endpoints, builds its own counterpart with
 * them, and then never touches them again. This half holds no SDK or `fetch` calls; each method is a
 * call straight down into its counterpart, wrapped in a `try`/`catch` that rethrows a `DslError`
 * naming the intention.
 *
 * The ledger has no part of its own to drive, so unlike a root with something to open or resize this
 * one has no counterpart: it only builds the four areas a spec reaches — what goes in (`requests`),
 * what is known about who sent it (`kyc`), what is written down (`records`) and what is announced (`events`).
 */
export class LedgerDsl {
  readonly requests: RequestsDsl;
  readonly kyc: KycDsl;
  readonly records: RecordsDsl;
  readonly events: EventsDsl;

  constructor(endpoints: LedgerEndpoints) {
    this.requests = new RequestsDsl(endpoints);
    this.kyc = new KycDsl(endpoints);
    this.records = new RecordsDsl(endpoints);
    this.events = new EventsDsl(endpoints);
  }
}
