import type {AcceptanceTestFixtures} from "@src/acceptance-criteria-mapping/AcceptanceTestFixtures";
import {test} from "@src/acceptance-criteria-mapping/AcceptanceTestFixtures";

type DefineSuite = () => void;

/**
 * A criterion sees the DSL and nothing else — no SDK client, no `fetch`, no endpoints. The AWS side
 * stays on this side of the boundary, so a spec cannot reach past the DSL and start talking to the
 * stack directly.
 */
type RunCriterion = (dsl: AcceptanceTestFixtures) => void | Promise<void>;

type TestBody = (fixtures: AcceptanceTestFixtures) => Promise<void>;

interface Suite {
  (criteria: string, define: DefineSuite): void;
}

interface Criterion {
  (criteria: string, run: RunCriterion): void;
}

interface Arrangement {
  (arrange: RunCriterion): void;
}

/**
 * `given` / `when` / `then` are thin wrappers over Vitest's `describe` / `it` that prefix the block
 * name, so a test run reads back as the acceptance criteria it was written from:
 *
 *   given a client submits a fractionalization request > when the worker has processed it > then ...
 *
 * `then` is the test itself, which is why it — and only it — receives the DSL.
 *
 * **It is exported as `criterionThat`, and a spec imports it `as then`.** A module that exports a
 * binding called `then` is a thenable, so when Vitest awaits the module's import it calls that
 * export as a promise callback and the file never finishes loading. The name is only ever spelled
 * out here; every spec still reads `then("...")`.
 */
export const given = suite("given");
export const when = suite("when");
export const criterionThat = criterion("then");

/**
 * The arrangement a `given` or a `when` has just named, carried out before each criterion beneath
 * it.
 *
 * A `when` says something happened. Without this, every `then` under it has to make it happen again
 * in its own body, and the criterion — the one line that spec is actually about — ends up buried
 * under setup it shares with its siblings. Anything a `then` does to the system before asserting
 * belongs up here.
 *
 * It receives the DSL and nothing else, exactly as a criterion does — the same `ledger` the
 * criterion beneath it gets, since Vitest builds the fixtures once per test.
 */
export const beforeEach = arrangement();

export {expect} from "@src/acceptance-criteria-mapping/AcceptanceTestFixtures";

function suite(prefix: string): Suite {
  return (criteria, define) => {
    describe(`${prefix} ${criteria}`, define);
  };
}

function criterion(prefix: string): Criterion {
  return (criteria, run) => {
    test(`${prefix} ${criteria}`, withDslOnly(run));
  };
}

function arrangement(): Arrangement {
  return arrange => {
    test.beforeEach(withDslOnly(arrange));
  };
}

/**
 * Rebuilds the argument object so a criterion receives only the DSL, whatever else Vitest passed in
 * (its own test context, the endpoints fixture). Types alone would stop at a cast; this stops at
 * runtime too.
 *
 * The destructuring here is also how Vitest decides which fixtures to build — it reads the
 * parameter names off this function — so a fixture added to `AcceptanceTestFixtures` must be named
 * here as well.
 */
function withDslOnly(run: RunCriterion): TestBody {
  return async ({ledger}: AcceptanceTestFixtures): Promise<void> => {
    await run({ledger});
  };
}
