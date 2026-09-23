import {vitestBaseConfig} from "@ledger/shared/config/vitest.base.js";
import {defineConfig} from "vitest/config";

export default defineConfig({
  ...vitestBaseConfig,
  test: {
    ...vitestBaseConfig.test,
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
