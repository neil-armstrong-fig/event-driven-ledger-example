import {baseConfig} from "@ledger/shared/config/eslint.base.js";

// The CDK app: deploys the worker's *built artifact*, never imports its source. Deny-by-default
// means `@ledger/worker` and `@ledger/domain` are refused simply by being left out of
// `allowedPackages` — see AGENTS.md's package table.
export default baseConfig({tsconfigRootDir: import.meta.dirname, allowedPackages: ["@ledger/shared"]});
