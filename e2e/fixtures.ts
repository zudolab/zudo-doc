/**
 * Extended Playwright test with a shared consoleErrors fixture.
 *
 * Import `test` and `expect` from this file instead of `@playwright/test`
 * in specs that need console-error / pageerror collection.
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
});
