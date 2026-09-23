import {baseConfig} from "./config/eslint.base.js";

// `shared` is the bottom of the dependency graph — it may not import any other workspace package.
//
// It may import itself, by its own name, and that is the only way one of its folders reaches another:
// `../` is refused everywhere, and an `@src` alias cannot work here, because `shared` is compiled as
// raw source by whichever package imports it — `@src` would resolve into that package's tree, not
// this one. `@ledger/shared/idempotency/IdempotencyKey` means the same thing from every package that
// reads it.
export default baseConfig({tsconfigRootDir: import.meta.dirname, allowedPackages: ["@ledger/shared"]});
