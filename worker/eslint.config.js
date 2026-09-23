import {baseConfig} from "@ledger/shared/config/eslint.base.js";

// The SQS-batch Lambda handler: wires `domain` logic to real AWS SDK calls. See AGENTS.md's
// package table.
export default baseConfig({
  tsconfigRootDir: import.meta.dirname,
  allowedPackages: ["@ledger/domain", "@ledger/shared"],
});
