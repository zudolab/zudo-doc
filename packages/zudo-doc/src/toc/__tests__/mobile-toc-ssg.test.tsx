/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */

import { afterEach, describe, expect, it } from "vitest";
import { renderIsland, renderSsr, flushAll } from "../../__tests__/helpers/zudo-react.js";
import { MobileToc } from "../mobile-toc.js";
import type { HeadingItem } from "../types.js";

const SAMPLE_HEADINGS: HeadingItem[] = [
  { depth: 2, slug: "introduction", text: "Introduction" },
  { depth: 3, slug: "prerequisites", text: "Prerequisites" },
  { depth: 2, slug: "configuration", text: "Configuration" },
  { depth: 4, slug: "advanced-options", text: "Advanced Options" },
];
const mounted: Array<() => void> = [];

afterEach(() => {
  for (const dispose of mounted.splice(0)) dispose();
});

describe("MobileToc — SSR markup", () => {
  it("renders every qualifying anchor while closed", () => {
    const html = renderSsr(<MobileToc headings={SAMPLE_HEADINGS} title="On this page" />);
    expect(html).toContain('href="#introduction"');
    expect(html).toContain('href="#prerequisites"');
    expect(html).toContain('href="#configuration"');
    expect(html).toContain('href="#advanced-options"');
    expect(html).toContain("On this page");
    expect(html).toContain("<ul");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("hidden");
  });

  it("preserves localized labels and the mobile-only hook", () => {
    const html = renderSsr(<MobileToc headings={SAMPLE_HEADINGS} title="目次" />);
    expect(html).toContain("目次");
    expect(html).toContain("data-zd-mobile-toc");
    expect(html).not.toContain("data-zd-toc=");
    expect(html).not.toContain("xmlns=");
  });

  it("renders the locale title without a panel when no headings qualify", () => {
    const html = renderSsr(<MobileToc headings={[]} title="目次" />);
    expect(html).toContain("目次");
    expect(html).not.toContain('href="#');
    expect(html).not.toContain("data-zd-mobile-toc");
  });

  it("filters out depth-one and depth-five headings", () => {
    const html = renderSsr(<MobileToc headings={[
      { depth: 1, slug: "page-title", text: "Page Title" },
      { depth: 2, slug: "section", text: "Section" },
      { depth: 5, slug: "too-deep", text: "Too Deep" },
    ]} />);
    expect(html).toContain('href="#section"');
    expect(html).not.toContain('href="#page-title"');
    expect(html).not.toContain('href="#too-deep"');
  });
});

describe("MobileToc — hydration and interaction", () => {
  it("hydrates closed markup, opens the links, and closes after a selection", async () => {
    const view = await renderIsland(MobileToc, { headings: SAMPLE_HEADINGS, title: "On this page" }, {
      identity: { component: "MobileToc", build: "test" },
    });
    mounted.push(view.dispose);

    expect(view.diagnostics).toEqual([]);
    const button = view.root.querySelector<HTMLButtonElement>("button")!;
    const list = view.root.querySelector<HTMLUListElement>("ul")!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(list.classList.contains("hidden")).toBe(true);

    button.click();
    await flushAll();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(list.getAttribute("aria-hidden")).toBe("false");
    expect(list.classList.contains("hidden")).toBe(false);
    expect(view.root.querySelector("svg")?.getAttribute("class")).toContain("rotate-180");

    view.root.querySelector<HTMLAnchorElement>('a[href="#introduction"]')!.click();
    await flushAll();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(list.getAttribute("aria-hidden")).toBe("true");
    expect(list.classList.contains("hidden")).toBe(true);
  });
});
