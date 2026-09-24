import {DslError} from "@src/dsl/errors/DslError";
import {RecordsClient} from "@src/dsl/ledger/components/records/aws/RecordsClient";
import type {RecordedRequest} from "@src/dsl/ledger/components/records/types/RecordedRequest";
import type {RecordKey} from "@src/dsl/ledger/components/records/types/RecordKey";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";

/** What the ledger has written down, reached as `ledger.records`. */
export class RecordsDsl {
  private readonly records: RecordsClient;

  constructor(endpoints: LedgerEndpoints) {
    this.records = new RecordsClient(endpoints);
  }

  /** Waits briefly for the request with this customer and idempotency key to be recorded; fails if it never is. */
  async waitForRecord(key: RecordKey): Promise<void> {
    try {
      await this.records.waitForRecord(key);
    } catch (error) {
      throw new DslError(
        `Failed to wait for the record of idempotency key ${key.idempotencyKey} for customer ${key.customerId}`,
        error,
      );
    }
  }

  /** Whether a record exists for this customer and idempotency key right now. */
  async isRecorded(key: RecordKey): Promise<boolean> {
    try {
      return await this.records.isRecorded(key);
    } catch (error) {
      throw new DslError(
        `Failed to read whether idempotency key ${key.idempotencyKey} for customer ${key.customerId} is recorded`,
        error,
      );
    }
  }

  /** The decision on record for this customer and idempotency key and what it rested on, or `undefined` if none is recorded. */
  async getRecordedRequestFor(key: RecordKey): Promise<RecordedRequest | undefined> {
    try {
      return await this.records.getRecordedRequestFor(key);
    } catch (error) {
      throw new DslError(
        `Failed to read the record of idempotency key ${key.idempotencyKey} for customer ${key.customerId}`,
        error,
      );
    }
  }
}
