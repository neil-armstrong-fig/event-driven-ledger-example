import {test as base} from "vitest";
import {readLedgerEndpoints} from "@src/dsl/ledger/aws/ReadLedgerEndpoints";
import type {LedgerEndpoints} from "@src/dsl/ledger/types/LedgerEndpoints";
import {LedgerDsl} from "@src/dsl/ledger/LedgerDsl";

/** The stack the specs run against — `pnpm acceptance-tests` expects it freshly deployed to LocalStack. */
const STACK_NAME = process.env["LEDGER_STACK_NAME"] ?? "LedgerStack";

/**
 * The DSL objects a spec can ask for. Each one arrives ready to use, and wrapped so the spec never
 * touches the AWS SDK or `fetch`.
 *
 * There is one for the system, deliberately: `ledger` is the whole deployed stack, and every area of
 * it is reached through a member of that rather than through a fixture of its own.
 *
 * Handing the endpoints to the DSL happens here: `LedgerDsl` takes them, builds its own counterpart
 * with them and passes the same endpoints down to each area, which does the same. A `*Dsl` may name
 * `LedgerEndpoints` for that and for nothing else — it never stores them, so `this.endpoints` cannot
 * be reached from a method, and a lint rule says so as well.
 */
export interface AcceptanceTestFixtures {
  ledger: LedgerDsl;
}

/** Not for specs: what building `ledger` needs, read from the stack once per spec file. */
interface EndpointsFixtures {
  endpoints: LedgerEndpoints;
}

export const test = base.extend<AcceptanceTestFixtures & EndpointsFixtures>({
  endpoints: [
    // Vitest reads fixture dependencies off an object-destructuring pattern and rejects any other
    // first argument, so this has to be an empty one even though it depends on nothing.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(await readLedgerEndpoints(STACK_NAME));
    },
    {scope: "file"},
  ],

  // A new DSL per spec, because reading the sink queue consumes its messages.
  ledger: async ({endpoints}, use) => {
    await use(new LedgerDsl(endpoints));
  },
});

export {expect} from "vitest";
