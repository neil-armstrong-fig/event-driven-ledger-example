import {srcAlias, vitestBaseConfig} from "@ledger/shared/config/vitest.base.js";
import {defineConfig} from "vitest/config";

/**
 * The given/when/then specs under `src/tests`, run against a deployed LocalStack stack. Kept out of
 * `vitest.config.ts` so `pnpm checks` never needs LocalStack.
 */
export default defineConfig({
  ...vitestBaseConfig,
  resolve: {alias: srcAlias(import.meta.dirname)},
  test: {
    ...vitestBaseConfig.test,
    include: ["src/tests/**/*.test.ts"],
    env: targetEnv(),
    // A request crosses API Gateway, SQS, Lambda, DynamoDB and EventBridge before there is anything to assert.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

/**
 * The AWS SDK reads these, so the specs talk to LocalStack unless told otherwise. LocalStack accepts any
 * credentials; the endpoint default is what stops a run reaching a real account. `ACCEPTANCE_TARGET=aws`
 * is the deliberate opt-in to a real deployment: nothing is defaulted, so the SDK uses the caller's own
 * credentials, region and endpoint.
 */
function targetEnv(): Record<string, string> {
  if (process.env["ACCEPTANCE_TARGET"] === "aws") return {};
  return {
    AWS_ENDPOINT_URL: process.env["AWS_ENDPOINT_URL"] ?? "http://localhost:4566",
    AWS_REGION: process.env["AWS_REGION"] ?? "us-east-1",
    AWS_ACCESS_KEY_ID: process.env["AWS_ACCESS_KEY_ID"] ?? "test",
    AWS_SECRET_ACCESS_KEY: process.env["AWS_SECRET_ACCESS_KEY"] ?? "test",
  };
}
