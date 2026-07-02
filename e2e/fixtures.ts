/**
 * Extended Playwright test with a shared consoleErrors fixture.
 *
 * Import `test` and `expect` from this file instead of `@playwright/test`
 * in specs that need console-error / pageerror collection. The check is
 * auto-asserted on teardown for EVERY test in a file that imports this
 * `test` (see `autoAssertNoConsoleErrors` below) — adopters no longer need
 * to remember to call anything. `assertNoConsoleErrors()` remains available
 * to call explicitly mid-test when a spec wants to pinpoint which
 * interaction produced an error; the teardown assertion still re-runs
 * afterwards over the (possibly larger, by then) collected list.
 */
import { test as base, expect } from "@playwright/test";

export { expect };

export type ConsoleErrorsFixture = {
  /** All console type=error messages and uncaught pageerror messages collected during the test. */
  consoleErrors: string[];
  /**
   * Assert that no actionable console errors occurred.
   * Filters the collected errors through a curated allowlist of known-benign messages.
   * Every allowlist entry carries a why-comment — do not add entries without justification.
   */
  assertNoConsoleErrors: () => void;
  /**
   * Auto-fixture — not meant to be requested by name in a test signature.
   * Its sole job is to call assertNoConsoleErrors() during teardown so every
   * test using this `test` gets the check for free.
   */
  autoAssertNoConsoleErrors: void;
};

/**
 * Messages matching any of these patterns are considered benign and excluded
 * from the assertion.  Every entry MUST have a why-comment.
 */
const ALLOWLIST: Array<{ pattern: string | RegExp; reason: string }> = [
  {
    // The preview server (zfb preview → wrangler dev) never serves
    // /favicon.ico, so browsers always log a 404 for it.  This is a dev/
    // preview infrastructure gap, not a product bug.
    pattern: "favicon",
    reason: "favicon 404 is expected on the preview server",
  },
];

function isAllowlisted(message: string): boolean {
  return ALLOWLIST.some(({ pattern }) =>
    typeof pattern === "string"
      ? message.includes(pattern)
      : pattern.test(message),
  );
}

export const test = base.extend<ConsoleErrorsFixture>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await use(errors);
  },

  assertNoConsoleErrors: async ({ consoleErrors }, use) => {
    const assert = () => {
      const actionable = consoleErrors.filter((msg) => !isAllowlisted(msg));
      expect(
        actionable,
        `Unexpected console errors:\n${actionable.join("\n")}`,
      ).toHaveLength(0);
    };
    await use(assert);
  },

  // `auto: true` + no destructuring required: this fixture instantiates
  // for every test in a file that imports `test` from here, attaching the
  // console/pageerror listeners (via the consoleErrors -> page fixture
  // chain) and asserting after the test body runs — teardown code that
  // throws fails the test it's tearing down, which is what makes this an
  // enforced auto-assert rather than an opt-in helper.
  autoAssertNoConsoleErrors: [
    async ({ assertNoConsoleErrors }, use) => {
      await use();
      assertNoConsoleErrors();
    },
    { auto: true },
  ],
});
