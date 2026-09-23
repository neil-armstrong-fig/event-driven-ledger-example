import {DslError} from "@src/dsl/errors/DslError";
import {EventsClient} from "@src/dsl/ledger/components/events/aws/EventsClient";
import type {KycPassedEvent} from "@src/dsl/ledger/components/events/types/KycPassedEvent";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** What the ledger has told the rest of the world, reached as `ledger.events`. */
export class EventsDsl {
  private readonly events: EventsClient;

  constructor(endpoints: LedgerEndpoints) {
    this.events = new EventsClient(endpoints);
  }

  /** Waits briefly until at least `atLeast` KYC-passed events carry this idempotency key; fails if they never do. */
  async waitForKycPassedEvents(idempotencyKey: string, {atLeast}: {atLeast: number}): Promise<void> {
    try {
      await this.events.waitForKycPassedEvents(idempotencyKey, atLeast);
    } catch (error) {
      throw new DslError(
        `Failed to wait for ${atLeast} KYC-passed event(s) for idempotency key ${idempotencyKey}`,
        error,
      );
    }
  }

  /** Every KYC-passed event emitted for this idempotency key so far. */
  async getKycPassedEventsFor(idempotencyKey: string): Promise<KycPassedEvent[]> {
    try {
      return await this.events.getKycPassedEventsFor(idempotencyKey);
    } catch (error) {
      throw new DslError(`Failed to read the KYC-passed events for idempotency key ${idempotencyKey}`, error);
    }
  }
}
