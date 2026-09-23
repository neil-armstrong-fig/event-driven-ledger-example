import {App} from "aws-cdk-lib";
import {Template} from "aws-cdk-lib/assertions";

import {LedgerStack} from "./LedgerStack";

const ASSET_HASH_PATTERN = /[0-9a-f]{64}\.zip/g;

it("synthesizes the ledger stack with no unnoticed resource or property changes", () => {
  const stack = new LedgerStack(new App(), "LedgerStack");

  const template = Template.fromStack(stack).toJSON();

  // The Lambda asset's S3Key is a content hash of the bundle — normalized so a worker code change
  // doesn't churn the snapshot (and train everyone to blindly run `-u`).
  expect(normalizeAssetHashes(template)).toMatchSnapshot();
});

function normalizeAssetHashes(template: object): unknown {
  return JSON.parse(JSON.stringify(template).replace(ASSET_HASH_PATTERN, "<asset-hash>.zip"));
}
