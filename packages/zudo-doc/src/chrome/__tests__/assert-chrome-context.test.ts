// assert-chrome-context unit tests (#2455).
//
// Verifies the runtime guard:
//   - A valid ChromeContext (from makeFakeChromeContext) → no throw.
//   - An object lacking `hostBindings` (pre-2.0 deps-bag shape) → throws with
//     a message mentioning the 2.0 migration and API.md.

import { describe, it, expect } from "vitest";
import { assertChromeContext } from "../assert-chrome-context.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

describe("assertChromeContext", () => {
  it("does not throw for a valid ChromeContext from makeFakeChromeContext", () => {
    const ctx = makeFakeChromeContext();
    expect(() => assertChromeContext(ctx, "createTestFactory")).not.toThrow();
  });

  it("throws when ctx is null", () => {
    expect(() => assertChromeContext(null, "createTestFactory")).toThrow(
      /createTestFactory/,
    );
  });

  it("throws when ctx is undefined", () => {
    expect(() =>
      assertChromeContext(undefined as unknown as { hostBindings?: unknown }, "createTestFactory"),
    ).toThrow(/createTestFactory/);
  });

  it("throws when ctx lacks hostBindings (pre-2.0 deps-bag shape)", () => {
    const oldDepsLikeBag = {
      settings: {},
      i18n: {},
      components: {},
      // hostBindings is intentionally absent — this is the pre-2.0 shape
    };
    expect(() =>
      assertChromeContext(oldDepsLikeBag, "createFooterWithDefaults"),
    ).toThrow(/createFooterWithDefaults/);
  });

  it("throws with a message pointing at 2.0 migration and API.md", () => {
    const oldDepsLikeBag = { settings: {}, i18n: {} };
    let caught: Error | undefined;
    try {
      assertChromeContext(oldDepsLikeBag, "createHeaderWithDefaults");
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeDefined();
    expect(caught?.message).toContain("createHeaderWithDefaults");
    expect(caught?.message).toContain("hostBindings");
    expect(caught?.message).toContain("2.0");
    expect(caught?.message).toContain("API.md");
  });

  it("does not throw when hostBindings is present (even if empty)", () => {
    const ctxWithBindings = {
      settings: {},
      i18n: {},
      components: {},
      hostBindings: {},
    };
    expect(() =>
      assertChromeContext(ctxWithBindings, "createSidebarWithDefaults"),
    ).not.toThrow();
  });
});
