/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */

import { afterEach, describe, expect, it } from "vitest";
import { renderSsr, renderIsland, flushAll } from "../../__tests__/helpers/zudo-react.js";
import { DesktopTocToggle, TOC_STORAGE_KEY } from "../index.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";

const mounted: Array<() => void> = [];

afterEach(() => {
  for (const dispose of mounted.splice(0)) dispose();
  document.documentElement.removeAttribute("data-toc-hidden");
  localStorage.clear();
});

describe("DesktopTocToggle — SSR markup", () => {
  it("renders the visible button and right chevron", () => {
    const html = renderSsr(<DesktopTocToggle />);
    expect(html).toContain("<button");
    expect(html).toContain('aria-label="Hide table of contents"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("zd-desktop-toc-toggle");
    expect(html).toContain('style="border-radius:var(--radius-DEFAULT) 0 0 var(--radius-DEFAULT)"');
    expect(html).not.toContain("data-zfb-transition-persist");
    expect(html).toContain('d="M9 5l7 7-7 7"');
  });
});

describe("DesktopTocToggle — hydration and persistence", () => {
  it("hydrates the SSR default, reconciles storage, and persists toggles", async () => {
    localStorage.setItem(TOC_STORAGE_KEY, "false");
    const view = await renderIsland(DesktopTocToggle, {}, {
      identity: { component: "DesktopTocToggle", build: "test" },
    });
    mounted.push(view.dispose);

    expect(view.diagnostics).toEqual([]);
    const button = view.root.querySelector<HTMLButtonElement>("button")!;
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Show table of contents");
    expect(view.root.querySelector("svg path")?.getAttribute("d")).toBe("M15 19l-7-7 7-7");
    expect(document.documentElement.hasAttribute("data-toc-hidden")).toBe(true);

    button.click();
    await flushAll();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem(TOC_STORAGE_KEY)).toBe("true");
    expect(document.documentElement.hasAttribute("data-toc-hidden")).toBe(false);

    button.click();
    await flushAll();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem(TOC_STORAGE_KEY)).toBe("false");
    expect(document.documentElement.hasAttribute("data-toc-hidden")).toBe(true);
  });

  it("reconciles after a swap and removes its listener on disposal", async () => {
    const view = await renderIsland(DesktopTocToggle, {}, {
      identity: { component: "DesktopTocToggle", build: "test" },
    });
    mounted.push(view.dispose);
    localStorage.setItem(TOC_STORAGE_KEY, "false");
    document.documentElement.removeAttribute("data-toc-hidden");

    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await flushAll();
    expect(document.documentElement.hasAttribute("data-toc-hidden")).toBe(true);

    view.dispose();
    mounted.pop();
    document.documentElement.removeAttribute("data-toc-hidden");
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    expect(document.documentElement.hasAttribute("data-toc-hidden")).toBe(false);
  });
});
