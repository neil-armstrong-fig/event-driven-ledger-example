import type {ViteUserConfig} from "vitest/config";

/**
 * Defaults every package's vitest config merges over. Keep it free of environment-specific
 * settings — those belong in the package that needs them.
 */
export const vitestBaseConfig: ViteUserConfig = {
  test: {
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    clearMocks: true,
    passWithNoTests: true,
  },
};
