/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import { render } from "preact-render-to-string";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { createSidebarWithDefaults } from "../../sidebar-with-defaults/index.js";
import { createHeaderWithDefaults } from "../../header-with-defaults/index.js";
import { SidebarTree } from "../../sidebar-tree-island/index.js";
import { SidebarToggle } from "../../sidebar-toggle-island/index.js";
import type { SidebarLocaleLink, SidebarNavNode } from "../../sidebar/types.js";

const nodes: SidebarNavNode[] = [{
  slug: "notes", label: "Notes", position: 0, hasPage: true, href: "/docs/notes",
  shape: "note-tray", noteTrayDated: true, noteTraySidebar: "month",
  children: [{
    slug: "notes/first", label: "First", position: 1, hasPage: true,
    href: "/docs/notes/first", date: "2026-08-22", children: [],
  }],
}];
const currentSlug = "notes/first";
const jaLinks: SidebarLocaleLink[] = [
  { code: "ja", label: "日本語", href: "/ja/docs/notes", active: true },
];

function islandProps(html: string): Record<string, unknown> {
  const encoded = /data-props="([^"]*)"/.exec(html)?.[1];
  expect(encoded).toBeDefined();
  return JSON.parse(encoded!
    .replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">")
    .replaceAll("&#39;", "'").replaceAll("&amp;", "&"));
}

describe("sidebar locale wiring", () => {
  for (const path of ["desktop", "mobile"] as const) {
    it(`${path} renders Japanese month headings with one default locale and no locale links`, () => {
      const ctx = makeFakeChromeContext({
        settings: { defaultLocale: "ja", locales: {} },
        overrides: {
          defaultLocale: "ja", locales: ["ja"],
          i18n: { defaultLocale: "ja", locales: ["ja"], getLocaleLabel: () => "日本語" },
          buildNavTree: () => nodes,
        },
      });
      // Omit lang to exercise the configured default, and scope the mobile drawer
      // so it renders the month-grouped tree rather than the root menu.
      const props = { currentSlug, navSection: "notes" };
      const vnode = path === "desktop"
        ? createSidebarWithDefaults(ctx)(props)
        : (createHeaderWithDefaults(ctx)(props) as VNode<Record<string, unknown>>)
          .props["sidebarToggle"] as VNode;
      const html = render(vnode);
      expect(html).toContain(`data-zfb-island="${path === "desktop" ? "SidebarTree" : "SidebarToggle"}"`);
      expect(html).toContain('aria-label="Collapse 2026年8月"');
      expect(html).not.toContain("2026 August");
      expect(islandProps(html).locale).toBe("ja");
      expect(islandProps(html)).not.toHaveProperty("localeLinks");
    });

    it(`${path} serializes English explicitly as well`, () => {
      const ctx = makeFakeChromeContext();
      const vnode = path === "desktop"
        ? createSidebarWithDefaults(ctx)({})
        : (createHeaderWithDefaults(ctx)({}) as VNode<Record<string, unknown>>)
          .props["sidebarToggle"] as VNode;
      expect(islandProps(render(vnode)).locale).toBe("en");
    });
  }

  for (const Component of [SidebarTree, SidebarToggle]) {
    it(`${Component.displayName} gives explicit locale precedence over active links`, () => {
      const html = render(<Component nodes={nodes} currentSlug={currentSlug} locale="en" localeLinks={jaLinks} />);
      expect(html).toContain('aria-label="Collapse 2026 August"');
      expect(html).not.toContain("2026年8月");
    });

    it(`${Component.displayName} preserves active-link and English fallbacks when locale is omitted`, () => {
      expect(render(<Component nodes={nodes} currentSlug={currentSlug} localeLinks={jaLinks} />))
        .toContain('aria-label="Collapse 2026年8月"');
      expect(render(<Component nodes={nodes} currentSlug={currentSlug} />))
        .toContain('aria-label="Collapse 2026 August"');
      expect(render(<Component nodes={nodes} currentSlug={currentSlug} localeLinks={jaLinks.map((link) => ({ ...link, active: false }))} />))
        .toContain('aria-label="Collapse 2026 August"');
    });
  }
});
