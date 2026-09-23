import {srcAlias, vitestBaseConfig} from "@ledger/shared/config/vitest.base.js";
import {defineConfig} from "vitest/config";

export default defineConfig({
  ...vitestBaseConfig,
  resolve: {alias: srcAlias(import.meta.dirname)},
});
