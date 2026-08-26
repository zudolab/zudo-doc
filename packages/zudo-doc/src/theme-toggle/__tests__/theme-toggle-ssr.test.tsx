/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { h } from "preact";
import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import ThemeToggleIsland from "../../theme/theme-toggle.js";
import * as ThemeToggleModule from "../index.js";
import { ThemeToggle } from "../index.js";

function buttonMarkup(html: string): string {
  const match = html.match(/<button\b[^>]*>/);
  expect(match).not.toBeNull();
  return match![0];
}

describe("ThemeToggle — SSR pending shape", () => {
  it.each([undefined, true])("emits the pending contract by default (%s)", (enabled) => {
    const html = render(h(ThemeToggle, { pendingUntilHydrated: enabled }));
    const button = buttonMarkup(html);

    expect(button).toMatch(/\sdata-zd-pending(?:=""|\s|>)/);
    expect(button).toContain('aria-disabled="true"');
    expect(button).not.toMatch(/\sdisabled(?:=|\s|>)/);
    expect(button).not.toMatch(/\sinert(?:=|\s|>)/);
  });

  it("omits the pending contract for the explicit opt-out", () => {
    const button = buttonMarkup(
      render(<ThemeToggle pendingUntilHydrated={false} />),
    );

    expect(button).not.toContain("data-zd-pending");
    expect(button).not.toContain("aria-disabled");
  });

  it("is deterministic across server rerenders", () => {
    expect(render(<ThemeToggle />)).toBe(render(<ThemeToggle />));
    expect(render(<ThemeToggle pendingUntilHydrated />)).toBe(
      render(<ThemeToggle pendingUntilHydrated />),
    );
  });

  it("keeps the island marker separate and read-only", () => {
    const html = render(<ThemeToggleIsland />);
    const button = buttonMarkup(html);

    expect(html).toContain('data-zfb-island="ThemeToggle"');
    expect(html).not.toContain("data-zfb-island-mounted");
    expect(button).toMatch(/\sdata-zd-pending(?:=""|\s|>)/);
    expect(button).toContain('aria-disabled="true"');
  });

  it("forwards the explicit opt-out through the island wrapper", () => {
    const html = render(<ThemeToggleIsland pendingUntilHydrated={false} />);
    const button = buttonMarkup(html);

    expect(html).toContain('data-zfb-island="ThemeToggle"');
    expect(button).not.toContain("data-zd-pending");
    expect(button).not.toContain("aria-disabled");
  });

  it("preserves the named export and displayName", () => {
    expect(ThemeToggleModule.ThemeToggle).toBe(ThemeToggle);
    expect(ThemeToggle.displayName).toBe("ThemeToggle");
  });
});
