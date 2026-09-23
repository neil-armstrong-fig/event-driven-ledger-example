import {processLedgerBatch} from "@src/batch/ProcessLedgerBatch";
import type {LedgerBatchDependencies} from "@src/batch/types/LedgerBatchDependencies";
import type {LedgerBatchRecord} from "@src/batch/types/LedgerBatchRecord";
import type {LedgerBatchResponse} from "@src/batch/types/LedgerBatchResponse";
import type {RecordOutcome} from "@src/batch/types/RecordOutcome";

interface PublishedEvent {
  assetId: string;
  idempotencyKey: string;
}

interface FakeLedger extends LedgerBatchDependencies {
  recordedKeys: Set<string>;
  published: PublishedEvent[];
  failRecordFor: Set<string>;
  failPublishFor: Set<string>;
}

let ledger: FakeLedger;
let response: LedgerBatchResponse;

describe("a ledger with nothing recorded", () => {
  beforeEach(() => {
    ledger = createFakeLedger();
  });

  describe("when a request arrives", () => {
    beforeEach(async () => {
      response = await processLedgerBatch(
        [record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1"})],
        ledger,
      );
    });

    it("emits KYC_PASSED_STUB for it", () => {
      expect(ledger.published).toEqual([{assetId: "asset-1", idempotencyKey: "idem-1"}]);
    });

    it("reports no failures", () => {
      expect(response).toEqual({batchItemFailures: []});
    });
  });

  describe("when two requests share an idempotency key but differ in requestId (double spend)", () => {
    beforeEach(async () => {
      response = await processLedgerBatch(
        [
          record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1", requestId: "req-a"}),
          record({messageId: "m2", idempotencyKey: "idem-1", assetId: "asset-1", requestId: "req-b"}),
        ],
        ledger,
      );
    });

    it("records the key once", () => {
      expect([...ledger.recordedKeys]).toEqual(["idem-1"]);
    });

    it("emits for both, delivery being at-least-once (Gap #2)", () => {
      expect(ledger.published).toEqual([
        {assetId: "asset-1", idempotencyKey: "idem-1"},
        {assetId: "asset-1", idempotencyKey: "idem-1"},
      ]);
    });
  });

  describe("when recording a request throws", () => {
    beforeEach(async () => {
      ledger.failRecordFor.add("idem-1");
      response = await processLedgerBatch(
        [record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1"})],
        ledger,
      );
    });

    it("emits nothing for it", () => {
      expect(ledger.published).toEqual([]);
    });

    it("reports it as failed", () => {
      expect(response).toEqual({batchItemFailures: [{itemIdentifier: "m1"}]});
    });
  });

  describe("when publishing a request's event throws", () => {
    beforeEach(async () => {
      ledger.failPublishFor.add("idem-1");
      response = await processLedgerBatch(
        [record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1"})],
        ledger,
      );
    });

    it("reports it as failed, so redelivery can retry the emit", () => {
      expect(response).toEqual({batchItemFailures: [{itemIdentifier: "m1"}]});
    });
  });

  describe("when the second of three requests in one FIFO group fails", () => {
    beforeEach(async () => {
      ledger.failRecordFor.add("idem-2");
      response = await processLedgerBatch(
        [
          record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1", groupId: "g1"}),
          record({messageId: "m2", idempotencyKey: "idem-2", assetId: "asset-2", groupId: "g1"}),
          record({messageId: "m3", idempotencyKey: "idem-3", assetId: "asset-3", groupId: "g1"}),
        ],
        ledger,
      );
    });

    it("fails it and every later one in the group", () => {
      expect(response).toEqual({batchItemFailures: [{itemIdentifier: "m2"}, {itemIdentifier: "m3"}]});
    });

    it("keeps the one before it", () => {
      expect(ledger.published).toEqual([{assetId: "asset-1", idempotencyKey: "idem-1"}]);
    });

    it("does not process the later one at all", () => {
      expect(ledger.recordedKeys.has("idem-3")).toBe(false);
    });
  });

  describe("when a request in one FIFO group fails and another group is healthy", () => {
    beforeEach(async () => {
      ledger.failRecordFor.add("idem-1");
      response = await processLedgerBatch(
        [
          record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1", groupId: "g1"}),
          record({messageId: "m2", idempotencyKey: "idem-2", assetId: "asset-2", groupId: "g2"}),
        ],
        ledger,
      );
    });

    it("fails only the broken group's request", () => {
      expect(response).toEqual({batchItemFailures: [{itemIdentifier: "m1"}]});
    });

    it("still processes the healthy group", () => {
      expect(ledger.published).toEqual([{assetId: "asset-2", idempotencyKey: "idem-2"}]);
    });
  });
});

describe("a ledger that has already recorded a key", () => {
  beforeEach(async () => {
    ledger = createFakeLedger();
    ledger.recordedKeys.add("idem-1");
    response = await processLedgerBatch(
      [record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1"})],
      ledger,
    );
  });

  it("still emits KYC_PASSED_STUB when the key arrives again (Gap #2, at-least-once)", () => {
    expect(ledger.published).toEqual([{assetId: "asset-1", idempotencyKey: "idem-1"}]);
  });

  it("reports no failures", () => {
    expect(response).toEqual({batchItemFailures: []});
  });
});

interface RecordOptions {
  messageId: string;
  idempotencyKey: string;
  assetId: string;
  requestId?: string;
  groupId?: string;
}

function record({
  messageId,
  idempotencyKey,
  assetId,
  requestId = messageId,
  groupId = "g1",
}: RecordOptions): LedgerBatchRecord {
  return {
    messageId,
    body: JSON.stringify({assetId, requestId}),
    messageAttributes: {IdempotencyKey: {stringValue: idempotencyKey}},
    attributes: {MessageGroupId: groupId},
  };
}

function createFakeLedger(): FakeLedger {
  const recordedKeys = new Set<string>();
  const published: PublishedEvent[] = [];
  const failRecordFor = new Set<string>();
  const failPublishFor = new Set<string>();

  return {
    recordedKeys,
    published,
    failRecordFor,
    failPublishFor,
    recordRequest(idempotencyKey: string): Promise<RecordOutcome> {
      if (failRecordFor.has(idempotencyKey)) {
        return Promise.reject(new Error("DynamoDB unavailable"));
      }
      const outcome: RecordOutcome = recordedKeys.has(idempotencyKey) ? "already-recorded" : "recorded";
      recordedKeys.add(idempotencyKey);
      return Promise.resolve(outcome);
    },
    publishKycPassed(detail: PublishedEvent): Promise<void> {
      if (failPublishFor.has(detail.idempotencyKey)) {
        return Promise.reject(new Error("EventBridge unavailable"));
      }
      published.push(detail);
      return Promise.resolve();
    },
  };
}
