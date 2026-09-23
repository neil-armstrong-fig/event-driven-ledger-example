import path from "node:path";

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

/**
 * Resolves the `@src/*` alias every package's tsconfig.json declares. TypeScript's `paths` only
 * affects `tsc`, not Vite's module resolution — without this, a test importing via `@src/*`
 * type-checks cleanly but fails at runtime with "Cannot find package". Call with
 * `import.meta.dirname` from the package's own vitest.config.ts.
 */
export function srcAlias(packageDir: string): Record<string, string> {
  return {"@src": path.join(packageDir, "src")};
}
