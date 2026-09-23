# AGENTS.md — shared

Bottom of the dependency graph — see the root `AGENTS.md` package table. Two jobs: `config/` holds
the base tool configuration every other package extends (`eslint.base.js`, `prettier.base.js`,
`tsconfig.base.json`, `vitest.base.ts`), and `src/` (not yet created) will hold the event schemas,
DTOs, and JSON Schema for the API Gateway request validator model — the wire contract between
`domain`/`worker` and `infra`.

**No `src/` yet.** This package is still config-only (Phase 2). Its first real content arrives
whenever `domain` or `infra` first needs a shared type or schema — likely Phase 3 or Phase 4, not a
dedicated phase of its own. Don't invent a folder layout ahead of that need; when the first schema
lands, name its folder for the subject (e.g. `events/`), not `types/` or `dtos/`.

## Import boundary

`eslint.config.js` sets `allowedPackages: ["@ledger/shared"]` — i.e. this package may only import
itself, by its own name, never another workspace package. That self-import is intentional and mirrors
janggi's `shared`: with `../` refused everywhere (`noParentImports` in `eslint.base.js`), one folder
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
