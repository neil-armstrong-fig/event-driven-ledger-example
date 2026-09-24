import {baseConfig, restrictedImports} from "@ledger/shared/config/eslint.base.js";

const acceptanceCriteriaMapping = "@src/acceptance-criteria-mapping/AcceptanceCriteriaMapping";

const awsSdkPatterns = ["@aws-sdk/*"];

const layerOrder = "Imports run tests -> acceptance-criteria-mapping -> dsl -> shared, never back up.";

export default [
  ...baseConfig({tsconfigRootDir: import.meta.dirname, allowedPackages: ["@ledger/shared"]}),
  {
    // Specs see the mapping, `src/shared/` and `@ledger/shared` — nothing else. That keeps them
    // readable as acceptance criteria and stops them reaching into the DSL, the AWS SDK or `fetch`
    // behind the mapping's back.
    files: ["src/tests/**"],
    rules: {
      // A `then` states one criterion and asserts it. Anything done TO the system before that
      // assertion is the arrangement its `given` or `when` already names, and belongs in a
      // `beforeEach` there — otherwise every sibling criterion repeats it and the one line the spec
      // is about is buried.
      //
      // The DSL splits cleanly by name, which is what makes this checkable at all: an action is a
      // verb (`submit`, `waitForRecord`), a query is not (`getKycPassedEventsFor`, `isRecorded`).
      // Adding an action to the DSL means adding it here too — the list cannot be derived.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'CallExpression[callee.name="then"] CallExpression[callee.property.name=/^(submit|submitWithoutCustomer|seedCustomer|waitForRecord|waitForKycPassedEvents|waitForKycRejectedEvents)$/]',
          message:
            "Arrange in a beforeEach on the given or when, not inside a then. A criterion asserts; it does not set up.",
        },
      ],
      "no-restricted-globals": ["error", {name: "fetch", message: "Specs talk to the DSL, never to the network."}],
      "no-restricted-imports": restrictedImports({
        allowedPackages: ["@ledger/shared"],
        patterns: [
          {group: awsSdkPatterns, message: "Specs talk to the DSL, never to the AWS SDK."},
          {
            // The mapping module itself is the one file specs may see; its neighbours are not.
            group: [
              "@src/acceptance-criteria-mapping/**",
              `!${acceptanceCriteriaMapping}`,
              "@src/dsl/**",
              "@src/tests/**",
            ],
            message: `A spec may import only '${acceptanceCriteriaMapping}' and '@src/shared/*'. Anything else belongs on the mapping's exports, or on the DSL reached through a fixture.`,
          },
        ],
      }),
    },
  },
  {
    // The mapping wires the DSL into Vitest, so it reaches down into `dsl/` — never back up.
    files: ["src/acceptance-criteria-mapping/**"],
    rules: {
      "no-restricted-imports": restrictedImports({
        allowedPackages: ["@ledger/shared"],
        patterns: [{group: ["@src/tests/**"], message: layerOrder}],
      }),
    },
  },
  {
    // The DSL knows about the system, and nothing about how tests are declared.
    files: ["src/dsl/**"],
    rules: {
      "no-restricted-imports": restrictedImports({
        allowedPackages: ["@ledger/shared"],
        patterns: [{group: ["@src/tests/**", "@src/acceptance-criteria-mapping/**"], message: layerOrder}],
      }),
    },
  },
  {
    // The AWS SDK and `fetch` live in `aws/` folders and nowhere else. Every DSL object is a pair —
    // the `*Dsl` that says what a test may do, and the `*Client` beside it that talks to the stack —
    // and this is what stops the halves growing back together: an SDK call outside an `aws/` folder
    // cannot even be written.
    //
    // The one thing a `*Dsl` may name is `LedgerEndpoints`, and only to build its own counterpart with
    // in its constructor. `no-restricted-syntax` below is the other half of the rule — the endpoints
    // may be passed on, never kept, so they are out of scope in every method and the stack can only
    // be reached through the counterpart.
    //
    // `AcceptanceTestFixtures` is exempt from all of it, and only because it is not under
    // `src/dsl/`: handing the endpoints to the DSL has to happen somewhere.
    files: ["src/dsl/**"],
    ignores: ["src/dsl/**/aws/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: 'MemberExpression[object.type="ThisExpression"][property.name="endpoints"]',
          message:
            "A *Dsl may not reach the endpoints from a method. Take them in the constructor, build the *Client beside this file with them, and go through that.",
        },
        {
          selector: 'PropertyDefinition[key.name="endpoints"], TSParameterProperty > Identifier[name="endpoints"]',
          message:
            "A *Dsl may not keep the endpoints. Take them as a plain constructor parameter, build the *Client beside this file with them, and let them go out of scope.",
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Only an `aws/` folder may call the network. Put it in the *Client beside this file and call it from here.",
        },
      ],
      "no-restricted-imports": restrictedImports({
        allowedPackages: ["@ledger/shared"],
        patterns: [
          {
            group: awsSdkPatterns,
            message:
              "Only an `aws/` folder may import the AWS SDK. Put the call in the *Client beside this file and call it from here.",
          },
          {group: ["@src/tests/**", "@src/acceptance-criteria-mapping/**"], message: layerOrder},
        ],
      }),
    },
  },
];
