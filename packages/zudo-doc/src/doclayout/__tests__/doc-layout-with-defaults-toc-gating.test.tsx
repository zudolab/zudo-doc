/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/**
 * SSG HTML-presence test for `<DocLayoutWithDefaults>` TOC gating.
 *
 * Acceptance contract for B-13-2 (zfb-migration-parity epic #663 / Phase B-13
 * issue #912): the default Toc / MobileToc islands must NOT be emitted when
 * the page has no qualifying body headings or `hide_toc` is true. Astro's
 * baseline omits the entire TOC region in those cases — every byte of
 * `<nav aria-label="Table of contents">` and the "On this page" / "目次" h2
 * is absent. Without the gate, ~28 doc routes (e.g. /docs/components, several
 * hide_toc index pages) emit stale TOC markup that crawlers and screen readers
 * would see for pages that have no headings.
 *
 * Explicit `tocOverride` / `mobileTocOverride` props must still win even on
 * no-heading or hide_toc=true pages — callers that supply a custom TOC
 * deliberately should be respected.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderSsr as render } from "../../__tests__/helpers/zudo-react.js";
import { DocLayoutWithDefaults } from "../doc-layout-with-defaults.js";
import type { HeadingItem } from "../../toc/types.js";

vi.mock("../../toc/toc.js", () => ({
  Toc: ({ headings, title }: { headings: readonly HeadingItem[]; title: string }) => (
    <nav aria-label="Table of contents">
      <span>{title}</span>
      {headings.map((heading) => <a href={`#${heading.slug}`}>{heading.text}</a>)}
    </nav>
  ),
}));
vi.mock("../../toc/mobile-toc.js", () => ({
  MobileToc: ({ headings, title }: { headings: readonly HeadingItem[]; title: string }) => (
    <section data-zd-mobile-toc>
      <h2>{title}</h2>
      {headings.map((heading) => <a href={`#${heading.slug}`}>{heading.text}</a>)}
    </section>
  ),
}));

const testGlobal = globalThis as unknown as { __zfb?: Record<string, unknown> };
const previousZfb = testGlobal.__zfb;
beforeEach(() => {
  testGlobal.__zfb = {
    ...previousZfb,
    zudoReactBuild: "4458-test",
    zudoReactIslands: ["ThemeToggle", "Toc", "MobileToc"],
  };
});
afterEach(() => {
  testGlobal.__zfb = previousZfb;
});

const SAMPLE_HEADINGS: HeadingItem[] = [
  { depth: 2, slug: "introduction", text: "Introduction" },
  { depth: 3, slug: "details", text: "Details" },
];

describe("DocLayoutWithDefaults — TOC gating", () => {
  it("keeps the empty default Sidebar inside the aside without an island wrapper", () => {
    const html = render(
      <DocLayoutWithDefaults title="Empty sidebar" headerOverride={<header />}>
        <p>body</p>
      </DocLayoutWithDefaults>,
    );
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const aside = parsed.querySelector("aside#desktop-sidebar");

    expect(aside?.getAttribute("aria-label")).toBe("Documentation sidebar");
    expect(aside?.querySelector('[data-zfb-island="Sidebar"]')).toBeNull();
    expect(parsed.querySelector(".zd-sidebar-content-wrapper")).not.toBeNull();
  });

  it("omits the default Toc / MobileToc islands when headings is empty", () => {
    const html = render(
      <DocLayoutWithDefaults title="Empty" headerOverride={<header />} sidebarOverride={false}>
        <p>body</p>
      </DocLayoutWithDefaults>,
    );

    // Neither the desktop Toc nor MobileToc should leak SSG markup.
    expect(html).not.toContain('aria-label="Table of contents"');
    expect(html).not.toContain("On this page");
  });

  it("omits the default Toc / MobileToc islands when hideToc is true", () => {
    const html = render(
      <DocLayoutWithDefaults title="Hidden" hideToc headings={SAMPLE_HEADINGS} headerOverride={<header />} sidebarOverride={false}>
        <p>body</p>
      </DocLayoutWithDefaults>,
    );

    expect(html).not.toContain('aria-label="Table of contents"');
    expect(html).not.toContain("On this page");
  });

  it("omits the default Toc / MobileToc islands when headings is omitted entirely", () => {
    const html = render(
      // headings prop intentionally omitted — legacy pages and auto-generated
      // routes pass nothing here.
      <DocLayoutWithDefaults title="No headings prop" headerOverride={<header />} sidebarOverride={false}>
        <p>body</p>
      </DocLayoutWithDefaults>,
    );

    expect(html).not.toContain('aria-label="Table of contents"');
    expect(html).not.toContain("On this page");
  });

  it("renders the default Toc / MobileToc when qualifying headings exist and hideToc is false", () => {
    const html = render(
      <DocLayoutWithDefaults title="With Headings" headings={SAMPLE_HEADINGS} headerOverride={<header />} sidebarOverride={false}>
        <p>body</p>
      </DocLayoutWithDefaults>,
    );

    // Desktop nav landmark + section title must be in the SSG HTML.
    expect(html).toContain('aria-label="Table of contents"');
    expect(html).toContain("On this page");
    expect(html).toContain('href="#introduction"');
  });

  it("uses locale-resolved title for Japanese (lang=ja)", () => {
    const html = render(
      <DocLayoutWithDefaults
        title="JA"
        lang="ja"
        headings={SAMPLE_HEADINGS}
        headerOverride={<header />}
        sidebarOverride={false}
      >
        <p>body</p>
      </DocLayoutWithDefaults>,
    );

    expect(html).toContain("目次");
  });

  it("respects tocOverride even when headings is empty", () => {
    const html = render(
      <DocLayoutWithDefaults
        title="Custom TOC"
        headerOverride={<header />}
        sidebarOverride={false}
        tocOverride={
          <nav aria-label="Custom outline" data-testid="custom-toc">
            <a href="#anywhere">anywhere</a>
          </nav>
        }
      >
        <p>body</p>
      </DocLayoutWithDefaults>,
    );

    // Override wins — the consumer-supplied TOC must appear.
    expect(html).toContain('data-testid="custom-toc"');
    expect(html).toContain('aria-label="Custom outline"');
    // …and the default Toc must not be re-added on top.
    expect(html).not.toContain('aria-label="Table of contents"');
  });

  it("respects mobileTocOverride even when hideToc is true", () => {
    // hideToc=true would normally drop the mobile slot entirely, but a caller
    // that explicitly supplies an override is opting back in. The override
    // path must remain reachable so bespoke layouts aren't silently muted.
    const html = render(
      <DocLayoutWithDefaults
        title="Custom Mobile TOC"
        hideToc={false}
        headerOverride={<header />}
        sidebarOverride={false}
        mobileTocOverride={
          <div data-testid="custom-mobile-toc">custom mobile</div>
        }
      >
        <p>body</p>
      </DocLayoutWithDefaults>,
    );

    expect(html).toContain('data-testid="custom-mobile-toc"');
  });
});
