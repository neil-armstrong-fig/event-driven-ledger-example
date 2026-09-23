import {baseConfig, restrictedImports} from "@ledger/shared/config/eslint.base.js";

// `domain` is pure business logic: idempotency-key semantics and the `KYC_PASSED_STUB` event
// payload builder, testable with no AWS resources running. See AGENTS.md ("Package table").
// Named packages (no wildcard) still need `paths`, since a `patterns` group only matches a
// multi-segment specifier like `aws-cdk-lib/aws-dynamodb`, not the bare package name itself.
const zeroAwsMessage = "domain must have zero AWS imports — see AGENTS.md's package table.";
const zeroAwsPaths = ["aws-cdk-lib", "constructs", "aws-sdk", "aws-lambda"].map(name => ({
  name,
  message: zeroAwsMessage,
}));

export default [
  ...baseConfig({tsconfigRootDir: import.meta.dirname, allowedPackages: ["@ledger/shared"]}),
  {
    rules: {
      "no-restricted-imports": restrictedImports({
        allowedPackages: ["@ledger/shared"],
        paths: zeroAwsPaths,
        patterns: [
          {group: ["@aws-sdk/*", "aws-cdk-lib/**", "@aws-cdk/*", "@aws-lambda-powertools/*"], message: zeroAwsMessage},
        ],
      }),
    },
  },
];
