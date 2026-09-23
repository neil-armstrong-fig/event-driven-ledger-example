# AGENTS.md — dsl

`src/dsl/` holds two halves of each thing, side by side:

- **`<Thing>Dsl.ts`** — what a spec is allowed to say. It holds no SDK or `fetch` calls. Each method is
  a call straight down into its counterpart, wrapped in a `try`/`catch` that rethrows a `DslError`
  naming the intention, so a failure reads as "Failed to wait for the record of idempotency key k1"
  rather than a raw timeout. Most are one-to-one; occasionally one sequences two calls.

  **It takes the `LedgerEndpoints` and builds its own counterpart with them, privately, in the
  constructor** — and that is the only thing it may do with them. It never keeps them (a `this.endpoints`
  or an `endpoints` field is a `no-restricted-syntax` error), so the stack can only be reached through
  the counterpart. A parent builds its children from the same endpoints it was given.

- **`aws/<Thing>Client.ts`** — the SDK calls, `fetch` and waits. It catches nothing: let the real error
  out and let the `*Dsl` name what was being attempted. Wrapping in both places buries the cause.

**Only an `aws/` folder may import `@aws-sdk/*` or call `fetch`** — a lint rule, so an SDK call written
in a `*Dsl` will not get past `pnpm checks`. `AcceptanceTestFixtures` is exempt, since handing the
endpoints to the DSL has to happen somewhere.

Each `*Dsl` is laid out counterpart first, then children, in the same order in the constructor, with a
blank line between: the counterpart is this object's own half (private, the only route to AWS), the
children are areas that hang off it (public, reached by name). A `*Dsl` with no children is the same
rule with nothing after the blank line. `LedgerDsl` has no counterpart of its own — the ledger has no
part of itself to drive — so it is only the children.

A folder tells you what it is by the same two names at every depth: a thing owns its `aws/`
counterpart, and everything inside that thing goes in its `components/` folder. Name folders for
subject; `dsl/shared/` holds what more than one `*Client` needs (`polling/` for `eventually`).

## Naming a method

A criterion should read as a sentence, so the name carries its grammar. Every method is one of three:

| Shape                            | Named                             | Reads as                                                |
| -------------------------------- | --------------------------------- | ------------------------------------------------------- |
| **Action** — does something      | a verb: `submit`, `waitForRecord` | `await ledger.requests.submit(request)`                 |
| **Question** — answers yes or no | `is…` / `can…`: `isRecorded`      | `expect(await ledger.records.isRecorded(k)).toBe(true)` |
| **Query** — fetches a value      | `get…`: `getKycPassedEventsFor`   | `expect(await ledger.events.getKycPassedEventsFor(k))…` |

`src/tests/AGENTS.md`'s action-in-a-`then` lint rule tells an arrangement from an assertion **by this
name**, so a new method that fetches a value and is not called `get…` slips past it. An action may
return a value (`submit` returns the HTTP status) so a `beforeEach` can hold it for the `then`.

**A new area is a new member of `LedgerDsl`**, not a new fixture, and **a new fixture must be named in
`withDslOnly`'s destructuring** (`AcceptanceCriteriaMapping.ts`) — Vitest reads that to decide which to
build.

**An `aws/` file puts its constants above the class and keeps class-owned detail inside it**, and a
`*Client` keeps no state between calls (its config — table name, queue URL — is not state). The one
exception, and why, is in `acceptance-tests/AGENTS.md`'s Traps.
