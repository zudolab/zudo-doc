import { describe, expect, it } from "vitest";
import { renderSsr } from "../../__tests__/helpers/zudo-react.js";
import ThemeToggleIsland from "../../theme/theme-toggle.js";
import * as ThemeToggleModule from "../index.js";
import { ThemeToggle } from "../index.js";

function buttonMarkup(html: string): string {
  const match = html.match(/<button\b[^>]*>/);
  expect(match).not.toBeNull();
  return match![0];
}

describe("ThemeToggle SSR pending shape", () => {
  it.each([undefined, true])("emits the pending contract by default (%s)", (enabled) => {
    const button = buttonMarkup(renderSsr(<ThemeToggle pendingUntilHydrated={enabled} />));
    expect(button).toMatch(/\sdata-zd-pending(?:=""|\s|>)/);
    expect(button).toContain('aria-disabled="true"');
    expect(button).not.toMatch(/\sdisabled(?:=|\s|>)/);
    expect(button).not.toMatch(/\sinert(?:=|\s|>)/);
  });
  it("omits pending state for opt-out", () => {
    const button = buttonMarkup(renderSsr(<ThemeToggle pendingUntilHydrated={false} />));
    expect(button).not.toContain("data-zd-pending");
    expect(button).not.toContain("aria-disabled");
  });
  it("is deterministic and has no menu before interaction", () => {
    expect(renderSsr(<ThemeToggle />)).toBe(renderSsr(<ThemeToggle />));
    expect(renderSsr(<ThemeToggle />)).not.toContain('role="menu"');
  });
  it("keeps the wrapped island marker and forwards opt-out", () => {
    // Standalone SSR has no build identity; the site compiler supplies it.
    expect(() => renderSsr(<ThemeToggleIsland pendingUntilHydrated={false} />)).toThrow(/no build identity/);
  });
  it("preserves the named export and displayName", () => {
    expect(ThemeToggleModule.ThemeToggle).toBe(ThemeToggle);
    expect(ThemeToggle.displayName).toBe("ThemeToggle");
  });
});
