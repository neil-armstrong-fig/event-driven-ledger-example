import {baseConfig, restrictedImports} from "@ledger/shared/config/eslint.base.js";

// The CDK app: deploys the worker's *built artifact*, never imports its source. Deny-by-default
// means `@ledger/worker` and `@ledger/domain` are refused simply by being left out of
// `allowedPackages` — see AGENTS.md's package table.
const config = baseConfig({tsconfigRootDir: import.meta.dirname, allowedPackages: ["@ledger/shared"]});

// bin/App.ts is the CDK CLI entry: it creates the App and the stacks, nothing else. Every decision
// (config, env, tags, conditionals) belongs in a stack, where the snapshot test can see it.
const binAppOnlyCreatesStacks = {
  files: ["bin/App.ts"],
  rules: {
    // Deny every import, then re-allow the two it needs: `App` and the stack classes.
    "no-restricted-imports": restrictedImports({
      allowedPackages: [],
      patterns: [
        {
          group: ["**", "!aws-cdk-lib", "!@src", "!@src/*Stack"],
          message: "bin/App.ts may only import App from 'aws-cdk-lib' and stacks from '@src/*Stack'.",
        },
      ],
    }),
    // Top level may only hold imports, `const app = new App()` and `new XStack(app, ...)`.
    "no-restricted-syntax": [
      "error",
      {
        selector: "Program > :not(ImportDeclaration, VariableDeclaration, ExpressionStatement)",
        message: "bin/App.ts has no logic: only imports, `const app = new App()` and `new XStack(app, ...)`.",
      },
      {
        selector: "CallExpression, ConditionalExpression, LogicalExpression",
        message: "bin/App.ts has no logic: move calls and conditionals into the stack.",
      },
      {
        selector: "MemberExpression[object.name='process']",
        message: "bin/App.ts must not read process.env: pass config through the stack instead.",
      },
    ],
    "max-lines": ["error", {max: 15, skipBlankLines: true, skipComments: true}],
  },
};

export default [...config, binAppOnlyCreatesStacks];
