import {App} from "aws-cdk-lib";
import {Template} from "aws-cdk-lib/assertions";
import {LEDGER_STACK_OUTPUTS} from "@ledger/shared/stack/LedgerStackOutputs";

import {LedgerStack} from "@src/LedgerStack";

const ASSET_HASH_PATTERN = /[0-9a-f]{64}\.zip/g;

/**
 * The stack is synthesized two ways: as it ships, and with the `includeEventSink` context flag the
 * acceptance tests deploy it with. Each has its own snapshot, so a change to either shows up as its
 * own reviewable diff — and a change that makes the acceptance stack stop providing what the specs
 * read is caught here, at `pnpm checks`, rather than as a hard-to-debug failure mid-run.
 */
describe("the production stack", () => {
  const template = Template.fromStack(new LedgerStack(new App(), "LedgerStack"));

  it("synthesizes with no unnoticed resource or property changes", () => {
    // The Lambda asset's S3Key is a content hash of the bundle — normalized so a worker code change
    // doesn't churn the snapshot (and train everyone to blindly run `-u`).
    expect(normalizeAssetHashes(template.toJSON())).toMatchSnapshot();
  });

  it("does not deploy the acceptance-test event sink, so it never ships in a real deployment", () => {
    template.resourceCountIs("AWS::Events::Rule", 0);
    expect(outputNames(template)).not.toContain(LEDGER_STACK_OUTPUTS.sinkQueueUrl);
  });
});

describe("the acceptance-test stack", () => {
  const template = Template.fromStack(new LedgerStack(acceptanceTestApp(), "LedgerStack"));

  it("synthesizes with no unnoticed resource or property changes", () => {
    expect(normalizeAssetHashes(template.toJSON())).toMatchSnapshot();
  });

  it("delivers KYC_PASSED_STUB events to a sink the acceptance tests can read", () => {
    template.hasResourceProperties("AWS::Events::Rule", {EventPattern: {"detail-type": ["KYC_PASSED_STUB"]}});
  });

  it("provides every output the acceptance tests read", () => {
    expect(outputNames(template)).toEqual(expect.arrayContaining(Object.values(LEDGER_STACK_OUTPUTS)));
  });
});

/** What `cdk deploy -c includeEventSink=true` does — the flag arrives as the string "true". */
function acceptanceTestApp(): App {
  return new App({context: {includeEventSink: "true"}});
}

function outputNames(template: Template): string[] {
  return Object.keys(template.toJSON().Outputs);
}

function normalizeAssetHashes(template: object): unknown {
  return JSON.parse(JSON.stringify(template).replace(ASSET_HASH_PATTERN, "<asset-hash>.zip"));
}
