import {srcAlias, vitestBaseConfig} from "@ledger/shared/config/vitest.base.js";
import {defineConfig} from "vitest/config";

/** Unit tests for the DSL itself. The acceptance specs under `src/tests` are excluded. */
export default defineConfig({
  ...vitestBaseConfig,
  resolve: {alias: srcAlias(import.meta.dirname)},
  test: {
    ...vitestBaseConfig.test,
    exclude: ["**/node_modules/**", "src/tests/**"],
  },
});
