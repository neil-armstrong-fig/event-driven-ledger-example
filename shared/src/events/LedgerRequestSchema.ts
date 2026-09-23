import type {JSONSchema4} from "json-schema";

export const LEDGER_REQUEST_SCHEMA: JSONSchema4 = {
  type: "object",
  required: ["assetId", "requestId"],
  properties: {
    assetId: {type: "string", minLength: 1},
    requestId: {type: "string", minLength: 1},
  },
};
