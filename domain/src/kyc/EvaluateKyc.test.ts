import {evaluateKyc} from "./EvaluateKyc";

const now = new Date("2026-09-24T12:00:00.000Z");
const later = "2027-09-24T12:00:00.000Z";
const earlier = "2026-09-23T12:00:00.000Z";

it("passes a verified customer whose verification has not expired", () => {
  expect(evaluateKyc({status: {status: "verified", expiresAt: later}, now})).toEqual({outcome: "passed"});
});

it("passes a verified customer whose verification never expires", () => {
  expect(evaluateKyc({status: {status: "verified"}, now})).toEqual({outcome: "passed"});
});

it("rejects a verified customer whose verification has expired, as expired", () => {
  expect(evaluateKyc({status: {status: "verified", expiresAt: earlier}, now})).toEqual({
    outcome: "rejected",
    reason: "expired",
  });
});

it("treats the very moment of expiry as expired", () => {
  expect(evaluateKyc({status: {status: "verified", expiresAt: now.toISOString()}, now})).toEqual({
    outcome: "rejected",
    reason: "expired",
  });
});

it("rejects a customer whose verification is still pending, as pending", () => {
  expect(evaluateKyc({status: {status: "pending"}, now})).toEqual({outcome: "rejected", reason: "pending"});
});

it("rejects a customer whose verification was rejected, as not verified", () => {
  expect(evaluateKyc({status: {status: "rejected"}, now})).toEqual({outcome: "rejected", reason: "not-verified"});
});

it("rejects a customer with no KYC on record, as not verified", () => {
  expect(evaluateKyc({status: undefined, now})).toEqual({outcome: "rejected", reason: "not-verified"});
});
