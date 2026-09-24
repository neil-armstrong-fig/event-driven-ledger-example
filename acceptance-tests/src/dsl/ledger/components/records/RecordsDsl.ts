import {DslError} from "@src/dsl/errors/DslError";
import {RecordsClient} from "@src/dsl/ledger/components/records/aws/RecordsClient";
import type {RecordedRequest} from "@src/dsl/ledger/components/records/types/RecordedRequest";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** What the ledger has written down, reached as `ledger.records`. */
export class RecordsDsl {
  private readonly records: RecordsClient;

  constructor(endpoints: LedgerEndpoints) {
    this.records = new RecordsClient(endpoints);
  }

  /** Waits briefly for the request with this idempotency key to be recorded; fails if it never is. */
  async waitForRecord(idempotencyKey: string): Promise<void> {
    try {
      await this.records.waitForRecord(idempotencyKey);
    } catch (error) {
      throw new DslError(`Failed to wait for the record of idempotency key ${idempotencyKey}`, error);
    }
  }

  /** Whether a record exists for this idempotency key right now. */
  async isRecorded(idempotencyKey: string): Promise<boolean> {
    try {
      return await this.records.isRecorded(idempotencyKey);
    } catch (error) {
      throw new DslError(`Failed to read whether idempotency key ${idempotencyKey} is recorded`, error);
    }
  }

  /** The decision on record for this idempotency key and what it rested on, or `undefined` if none is recorded. */
  async getRecordedRequestFor(idempotencyKey: string): Promise<RecordedRequest | undefined> {
    try {
      return await this.records.getRecordedRequestFor(idempotencyKey);
    } catch (error) {
      throw new DslError(`Failed to read the record of idempotency key ${idempotencyKey}`, error);
    }
  }
}
