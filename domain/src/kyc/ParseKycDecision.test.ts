import {parseKycDecision} from "./ParseKycDecision";

it("reads a stored pass", () => {
  expect(parseKycDecision({outcome: "passed"})).toEqual({outcome: "passed"});
});

it.each(["not-verified", "pending", "expired"])("reads a stored rejection for %s", reason => {
  expect(parseKycDecision({outcome: "rejected", reason})).toEqual({outcome: "rejected", reason});
});

it("refuses a rejection whose reason is not one of the known reasons", () => {
  expect(() => parseKycDecision({outcome: "rejected", reason: "suspicious"})).toThrow(
    "Unknown KYC rejection reason: suspicious",
  );
});

it("refuses a rejection with no reason", () => {
  expect(() => parseKycDecision({outcome: "rejected"})).toThrow("Unknown KYC rejection reason: undefined");
});

it("refuses an outcome that is neither passed nor rejected", () => {
  expect(() => parseKycDecision({outcome: "maybe"})).toThrow("Unknown KYC outcome: maybe");
});
