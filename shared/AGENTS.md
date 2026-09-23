# AGENTS.md — shared

Bottom of the dependency graph — see the root `AGENTS.md` package table. Two jobs: `config/` holds
the base tool configuration every other package extends (`eslint.base.js`, `prettier.base.js`,
`tsconfig.base.json`, `vitest.base.ts`), and `src/` holds the event schemas, DTOs, and JSON Schema for
the API Gateway request validator model — the wire contract between `domain`/`worker` and `infra`.

First real content landed at Phase 4 step 4: `src/events/LedgerRequestSchema.ts` —
`LEDGER_REQUEST_SCHEMA`, the plain JSON Schema object `infra`'s `LedgerApi` construct passes to the
API GW request validator model (cast to CDK's own `JsonSchema` type at the `infra` call site, not here
— `shared` stays framework-agnostic and does not import `aws-cdk-lib`). Typed as `JSONSchema4` from
`@types/json-schema` (a types-only devDependency, matching the draft-04 default CDK's `Model`
construct actually renders — confirmed against the synthesized snapshot, not assumed). Folder named
for subject (`events/`), per convention.

`src/stack/LedgerStackOutputs.ts` (`LEDGER_STACK_OUTPUTS`, the CloudFormation output names) and
`src/api/FractionalizationRequestsPath.ts` are the contract between `infra` (which provides them) and
`acceptance-tests` (which reads them). `infra`'s tests assert the acceptance-test stack provides every
output and serves that path, so drift fails `pnpm checks` rather than an acceptance run.

## Import boundary

`eslint.config.js` sets `allowedPackages: ["@ledger/shared"]` — i.e. this package may only import
itself, by its own name, never another workspace package. That self-import is intentional: with `../` refused everywhere (`noParentImports` in `eslint.base.js`), one folder
here reaches another the same way any external package would — `@ledger/shared/events/...` — never a
relative climb.

## Tool config changes

Change a lint/format/tsconfig/vitest rule **here**, not in a package's local override. Packages call
`baseConfig({tsconfigRootDir, allowedPackages})` from `config/eslint.base.js`, and `domain` shows the
right way to add package-specific restrictions on top: it composes a second config object whose rule
calls `restrictedImports({...})` again, rather than writing `no-restricted-imports` directly. Flat
config **replaces** a rule outright instead of merging it, so a bare `no-restricted-imports` override
would silently drop the workspace boundary for those files — always go through `restrictedImports`.
See the doc comments in `config/eslint.base.js` itself (`restrictedImports`, `baseConfig`,
`assertTsconfigRootDir`) before changing any of it — they explain non-obvious constraints (e.g. why
`tsconfigRootDir` must always be passed explicitly, never inferred).

## What belongs here vs. what doesn't

Wire contracts and pure types only — the JSON Schema the API GW validator model needs, and any DTO
shape more than one package must agree on byte-for-byte. Business logic (idempotency-key semantics,
event payload construction) belongs in `domain`, not here, even though it's tempting to fold a small
builder function in alongside its type.
