import type {KycStatusRecord} from "@ledger/domain/kyc/types/KycStatusRecord";
import {KYC_DETAIL_TYPES} from "@ledger/shared/events/KycDetailTypes";

import {processLedgerBatch} from "@src/batch/ProcessLedgerBatch";
import type {LedgerBatchDependencies} from "@src/batch/types/LedgerBatchDependencies";
import type {LedgerBatchRecord} from "@src/batch/types/LedgerBatchRecord";
import type {LedgerBatchResponse} from "@src/batch/types/LedgerBatchResponse";
import type {RequestRecord} from "@src/batch/types/RequestRecord";

interface PublishedEvent {
  detailType: string;
  detail: object;
}

interface FakeLedger extends LedgerBatchDependencies {
  kycStatuses: Map<string, KycStatusRecord>;
  recorded: Map<string, RequestRecord>;
  published: PublishedEvent[];
  failRecordFor: Set<string>;
  failPublishFor: Set<string>;
  failKycLookupFor: Set<string>;
}

const NOW = new Date("2026-09-24T12:00:00.000Z");
const A_YEAR_ON = "2027-09-24T12:00:00.000Z";
const YESTERDAY = "2026-09-23T12:00:00.000Z";
const VERIFIED: KycStatusRecord = {status: "verified", expiresAt: A_YEAR_ON};

let ledger: FakeLedger;
let response: LedgerBatchResponse;

describe("a ledger whose customer is verified", () => {
  beforeEach(() => {
    ledger = createFakeLedger();
    ledger.kycStatuses.set("customer-1", VERIFIED);
  });

  describe("when a request arrives", () => {
    beforeEach(async () => {
      response = await processLedgerBatch(
        [record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1"})],
        ledger,
      );
    });

    it("emits KYC_PASSED for the customer and asset", () => {
      expect(ledger.published).toEqual([passed({assetId: "asset-1", idempotencyKey: "idem-1"})]);
    });

    it("records the decision, and the KYC status it rested on", () => {
      expect(ledger.recorded.get("idem-1")).toEqual({
        idempotencyKey: "idem-1",
        customerId: "customer-1",
        assetId: "asset-1",
        decision: {outcome: "passed"},
        kycStatus: "verified",
        decidedAt: NOW.toISOString(),
      });
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
      expect([...ledger.recorded.keys()]).toEqual(["idem-1"]);
    });

    it("emits for both, delivery being at-least-once (Gap #2)", () => {
      expect(ledger.published).toEqual([
        passed({assetId: "asset-1", idempotencyKey: "idem-1"}),
        passed({assetId: "asset-1", idempotencyKey: "idem-1"}),
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

  describe("when looking up the customer's KYC throws", () => {
    beforeEach(async () => {
      ledger.failKycLookupFor.add("customer-1");
      response = await processLedgerBatch(
        [record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1"})],
        ledger,
      );
    });

    it("decides nothing, rather than guessing", () => {
      expect(ledger.recorded.size).toBe(0);
      expect(ledger.published).toEqual([]);
    });

    it("reports it as failed, so redelivery can try again", () => {
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
      expect(ledger.published).toEqual([passed({assetId: "asset-1", idempotencyKey: "idem-1"})]);
    });

    it("does not process the later one at all", () => {
      expect(ledger.recorded.has("idem-3")).toBe(false);
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
      expect(ledger.published).toEqual([passed({assetId: "asset-2", idempotencyKey: "idem-2"})]);
    });
  });
});

describe("a ledger whose customer has not passed KYC", () => {
  beforeEach(() => {
    ledger = createFakeLedger();
  });

  describe("when their KYC is still pending", () => {
    beforeEach(async () => {
      ledger.kycStatuses.set("customer-1", {status: "pending"});
      response = await processLedgerBatch(
        [record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1"})],
        ledger,
      );
    });

    it("emits KYC_REJECTED, because it is pending, and no KYC_PASSED", () => {
      expect(ledger.published).toEqual([rejected({assetId: "asset-1", idempotencyKey: "idem-1", reason: "pending"})]);
    });

    it("records the rejection, and the KYC status it rested on", () => {
      expect(ledger.recorded.get("idem-1")).toEqual({
        idempotencyKey: "idem-1",
        customerId: "customer-1",
        assetId: "asset-1",
        decision: {outcome: "rejected", reason: "pending"},
        kycStatus: "pending",
        decidedAt: NOW.toISOString(),
      });
    });

    it("reports no failure: a rejection is an outcome, not a fault to retry into the DLQ", () => {
      expect(response).toEqual({batchItemFailures: []});
    });
  });

  describe("when their verification has expired", () => {
    beforeEach(async () => {
      ledger.kycStatuses.set("customer-1", {status: "verified", expiresAt: YESTERDAY});
      await processLedgerBatch([record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1"})], ledger);
    });

    it("emits KYC_REJECTED, because it has expired", () => {
      expect(ledger.published).toEqual([rejected({assetId: "asset-1", idempotencyKey: "idem-1", reason: "expired"})]);
    });
  });

  describe("when the body claims to be a verified customer, but the caller is a pending one", () => {
    beforeEach(async () => {
      ledger.kycStatuses.set("customer-1", {status: "pending"});
      ledger.kycStatuses.set("customer-2", VERIFIED);
      await processLedgerBatch(
        [record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1", claimedCustomerId: "customer-2"})],
        ledger,
      );
    });

    it("decides for the customer the request came from, never the one it names (0003)", () => {
      expect(ledger.published).toEqual([rejected({assetId: "asset-1", idempotencyKey: "idem-1", reason: "pending"})]);
    });
  });

  describe("when the ledger has nothing on them", () => {
    beforeEach(async () => {
      await processLedgerBatch([record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1"})], ledger);
    });

    it("emits KYC_REJECTED, because they are not verified", () => {
      expect(ledger.published).toEqual([
        rejected({assetId: "asset-1", idempotencyKey: "idem-1", reason: "not-verified"}),
      ]);
    });

    it("records no KYC status, since there was none to rest on", () => {
      expect(ledger.recorded.get("idem-1")?.kycStatus).toBeUndefined();
    });
  });
});

describe("a ledger that has already decided a key", () => {
  beforeEach(() => {
    ledger = createFakeLedger();
  });

  describe("as a rejection, for a customer who has since been verified", () => {
    beforeEach(async () => {
      const decided: RequestRecord = {
        idempotencyKey: "idem-1",
        customerId: "customer-1",
        assetId: "asset-1",
        decision: {outcome: "rejected", reason: "pending"},
        kycStatus: "pending",
        decidedAt: YESTERDAY,
      };
      ledger.recorded.set("idem-1", decided);
      ledger.kycStatuses.set("customer-1", VERIFIED);
      response = await processLedgerBatch(
        [record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1"})],
        ledger,
      );
    });

    it("announces the rejection again, as first decided (0003), never a pass", () => {
      expect(ledger.published).toEqual([rejected({assetId: "asset-1", idempotencyKey: "idem-1", reason: "pending"})]);
    });

    it("leaves the record on file as it was", () => {
      expect(ledger.recorded.get("idem-1")?.decidedAt).toBe(YESTERDAY);
    });

    it("reports no failures", () => {
      expect(response).toEqual({batchItemFailures: []});
    });
  });

  describe("as a pass, for a customer whose KYC has since been revoked", () => {
    beforeEach(async () => {
      ledger.recorded.set("idem-1", {
        idempotencyKey: "idem-1",
        customerId: "customer-1",
        assetId: "asset-1",
        decision: {outcome: "passed"},
        kycStatus: "verified",
        decidedAt: YESTERDAY,
      });
      ledger.kycStatuses.set("customer-1", {status: "rejected"});
      await processLedgerBatch([record({messageId: "m1", idempotencyKey: "idem-1", assetId: "asset-1"})], ledger);
    });

    it("still emits KYC_PASSED when the key arrives again (Gap #2, at-least-once)", () => {
      expect(ledger.published).toEqual([passed({assetId: "asset-1", idempotencyKey: "idem-1"})]);
    });
  });
});

interface RecordOptions {
  messageId: string;
  idempotencyKey: string;
  assetId: string;
  customerId?: string;
  /** A `customerId` written into the body, which nothing may believe. */
  claimedCustomerId?: string;
  requestId?: string;
  groupId?: string;
}

function record({
  messageId,
  idempotencyKey,
  assetId,
  customerId = "customer-1",
  claimedCustomerId,
  requestId = messageId,
  groupId = "g1",
}: RecordOptions): LedgerBatchRecord {
  const body: Record<string, string> = {assetId, requestId};
  if (claimedCustomerId) {
    body["customerId"] = claimedCustomerId;
  }

  return {
    messageId,
    body: JSON.stringify(body),
    messageAttributes: {IdempotencyKey: {stringValue: idempotencyKey}, CustomerId: {stringValue: customerId}},
    attributes: {MessageGroupId: groupId},
  };
}

interface PassedOptions {
  assetId: string;
  idempotencyKey: string;
}

function passed({assetId, idempotencyKey}: PassedOptions): PublishedEvent {
  return {detailType: KYC_DETAIL_TYPES.passed, detail: {assetId, idempotencyKey, customerId: "customer-1"}};
}

interface RejectedOptions extends PassedOptions {
  reason: string;
}

function rejected({assetId, idempotencyKey, reason}: RejectedOptions): PublishedEvent {
  return {
    detailType: KYC_DETAIL_TYPES.rejected,
    detail: {assetId, idempotencyKey, customerId: "customer-1", reason},
  };
}

function createFakeLedger(): FakeLedger {
  const kycStatuses = new Map<string, KycStatusRecord>();
  const recorded = new Map<string, RequestRecord>();
  const published: PublishedEvent[] = [];
  const failRecordFor = new Set<string>();
  const failPublishFor = new Set<string>();
  const failKycLookupFor = new Set<string>();

  return {
    kycStatuses,
    recorded,
    published,
    failRecordFor,
    failPublishFor,
    failKycLookupFor,
    getKycStatus(customerId: string): Promise<KycStatusRecord | undefined> {
      if (failKycLookupFor.has(customerId)) {
        return Promise.reject(new Error("DynamoDB unavailable"));
      }
      return Promise.resolve(kycStatuses.get(customerId));
    },
    now(): Date {
      return NOW;
    },
    recordRequest(request: RequestRecord): Promise<RequestRecord> {
      if (failRecordFor.has(request.idempotencyKey)) {
        return Promise.reject(new Error("DynamoDB unavailable"));
      }
      const onFile = recorded.get(request.idempotencyKey) ?? request;
      recorded.set(request.idempotencyKey, onFile);
      return Promise.resolve(onFile);
    },
    publishKycPassed(detail): Promise<void> {
      return publish(KYC_DETAIL_TYPES.passed, detail);
    },
    publishKycRejected(detail): Promise<void> {
      return publish(KYC_DETAIL_TYPES.rejected, detail);
    },
  };

  function publish(detailType: string, detail: PublishedEvent["detail"] & {idempotencyKey: string}): Promise<void> {
    if (failPublishFor.has(detail.idempotencyKey)) {
      return Promise.reject(new Error("EventBridge unavailable"));
    }
    published.push({detailType, detail});
    return Promise.resolve();
  }
}
