import {parseKycStatus} from "./ParseKycStatus";

it.each(["verified", "pending", "rejected"])("reads %s as a KYC status", status => {
  expect(parseKycStatus(status)).toBe(status);
});

it("refuses a word that is not a KYC status, rather than trusting what the table holds", () => {
  expect(() => parseKycStatus("approved")).toThrow("Unknown KYC status: approved");
});
