interface EventuallyOptions {
  timeoutMs: number;
  intervalMs: number;
}

/**
 * Polls until `poll` returns a defined value, or rejects once `timeoutMs` has passed. A throw from
 * `poll` counts as "not yet" (a resource that isn't ready) and is kept only to explain the timeout.
 * Used instead of a fixed sleep — see acceptance-tests/AGENTS.md.
 */
export async function eventually<T>(poll: () => Promise<T | undefined>, options: EventuallyOptions): Promise<T> {
  const deadline = Date.now() + options.timeoutMs;
  let lastError: unknown;

  for (;;) {
    try {
      const value = await poll();
      if (value !== undefined) return value;
    } catch (error) {
      lastError = error;
    }

    if (Date.now() >= deadline) throw timeoutError(options.timeoutMs, lastError);
    await delay(options.intervalMs);
  }
}

function timeoutError(timeoutMs: number, lastError: unknown): Error {
  return new Error(`eventually() timed out after ${timeoutMs}ms; ${describeCause(lastError)}`);
}

function describeCause(lastError: unknown): string {
  if (lastError === undefined) {
    return "it never returned a value";
  }
  return `the last error was: ${String(lastError)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
