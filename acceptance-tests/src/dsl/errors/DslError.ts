/** Wraps a failure with the DSL-level intent, so a test failure says what was being attempted. */
export class DslError extends Error {
  constructor(message: string, previousError: unknown) {
    super(message);
    this.name = "DslError";

    if (previousError instanceof Error) {
      this.stack += `\n\nCaused by: ${previousError.stack}`;
    }
  }

  static describe(objectToPrint: object): string {
    return JSON.stringify(objectToPrint);
  }
}
