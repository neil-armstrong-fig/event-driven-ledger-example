import {baseConfig} from "@ledger/shared/config/eslint.base.js";

// ATDD DSL + given/when/then specs run against a deployed LocalStack stack. May import `@ledger/shared`
// plus its own `aws/*Client.ts` wrappers — see AGENTS.md's package table.
export default baseConfig({tsconfigRootDir: import.meta.dirname, allowedPackages: ["@ledger/shared"]});
