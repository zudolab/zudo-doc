// Renderer-level proof for #4784: `/sitemap.xml` reads lastmod from the
// chrome-bindings doc-history manifest and omits it when no date is known.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../../config.js";
import { createRouteContext } from "../../route-context/index.js";
import type { Settings } from "../../settings.js";

const state = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  enumerateSitemapEntries: (() => []) as (options?: unknown) => unknown[],
  chromeBindings: {} as { docHistoryMeta?: Record<string, unknown> },
}));

vi.mock("../_context.js", () => ({
  get settings() {
    return state.settings;
  },
  enumerateSitemapEntries: (options?: unknown) => state.enumerateSitemapEntries(options),
}));
vi.mock("virtual:zudo-doc-chrome-bindings", () => ({
  get chromeBindings() {
    return state.chromeBindings;
  },
}));

import Sitemap from "../sitemap.xml.js";

const docs = [
  { slug: "index", data: { title: "Home" } },
  { slug: "guides/intro", data: { title: "Intro" } },
];
const jaDocs = [{ slug: "guides/intro", data: { title: "Intro JA" } }];

function useSettings(overrides: Partial<Settings>): void {
  const settings = {
    ...DEFAULT_SETTINGS,
    base: "/",
    trailingSlash: true,
    defaultLocale: "en",
    locales: {},
    docTags: false,
    sitemap: true,
    siteUrl: "https://example.com",
    ...overrides,
  } as Settings;
  const context = createRouteContext(
    {
      settings,
      translations: {},
      tagVocabulary: [],
      colorSchemes: null,
      themePackRegistry: null,
      assetManifest: null,
    },
    {
      stableDocs: (name: string) =>
        (name === "docs" ? docs : name === "docs-ja" ? jaDocs : []) as never,
    },
  );
  state.settings = settings as unknown as Record<string, unknown>;
  state.enumerateSitemapEntries = context.enumerateSitemapEntries as (o?: unknown) => unknown[];
}

const meta = {
  index: { updatedDate: "2026-01-02T10:00:00Z" },
  "guides/intro": { updatedDate: "2026-03-04T08:00:00+09:00" },
};

function urlBlocks(xml: string): string[] {
  return xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
}

describe("sitemap.xml lastmod (#4784)", () => {
  beforeEach(() => {
    state.chromeBindings = {};
  });

  it("emits each document page's doc-history date when docHistory is on", () => {
    useSettings({ docHistory: true });
    state.chromeBindings = { docHistoryMeta: meta };
    const xml = Sitemap();

    expect(xml).toContain(
      "<loc>https://example.com/docs/</loc>\n    <lastmod>2026-01-02</lastmod>",
    );
    expect(xml).toContain(
      "<loc>https://example.com/docs/guides/intro/</loc>\n    <lastmod>2026-03-03</lastmod>",
    );
    // The site root has no source document, so it carries no date.
    expect(xml).toContain("<loc>https://example.com/</loc>\n  </url>");
  });

  it("omits every lastmod when docHistory is on but the manifest is empty (history generation skipped)", () => {
    useSettings({ docHistory: true });
    state.chromeBindings = { docHistoryMeta: {} };
    const xml = Sitemap();

    expect(urlBlocks(xml).length).toBeGreaterThan(1);
    expect(xml).not.toContain("<lastmod>");
  });

  it("omits every lastmod when docHistory is off, even if bindings carry a manifest", () => {
    useSettings({ docHistory: false });
    state.chromeBindings = { docHistoryMeta: meta };
    const xml = Sitemap();

    expect(urlBlocks(xml).length).toBeGreaterThan(1);
    expect(xml).not.toContain("<lastmod>");
  });

  it("stays well-formed: one loc per url, urlset closed", () => {
    useSettings({ docHistory: true });
    state.chromeBindings = { docHistoryMeta: meta };
    const xml = Sitemap();

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset')).toBe(true);
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
    for (const block of urlBlocks(xml)) {
      expect(block.match(/<loc>/g)).toHaveLength(1);
      expect((block.match(/<lastmod>/g) ?? []).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("sitemap.xml hreflang alternates (#4787)", () => {
  const ja = { ja: { label: "JA", dir: "src/content/docs-ja" } };

  it("adds xhtml:link alternates for pages real in both locales", () => {
    useSettings({ locales: ja } as Partial<Settings>);
    const xml = Sitemap();

    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    );
    const alternates =
      '\n    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/docs/guides/intro/"/>' +
      '\n    <xhtml:link rel="alternate" hreflang="ja" href="https://example.com/ja/docs/guides/intro/"/>' +
      '\n    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/docs/guides/intro/"/>';
    expect(xml).toContain(`<loc>https://example.com/docs/guides/intro/</loc>${alternates}`);
    expect(xml).toContain(`<loc>https://example.com/ja/docs/guides/intro/</loc>${alternates}`);
    // The English-only root doc has a fallback /ja/ route, so it stays unpaired.
    expect(xml).toContain("<loc>https://example.com/docs/</loc>\n  </url>");
    expect(xml).toContain("<loc>https://example.com/ja/docs/</loc>\n  </url>");
  });

  it("emits no alternates and no xhtml namespace without siteUrl", () => {
    useSettings({ locales: ja, siteUrl: "" } as Partial<Settings>);
    const xml = Sitemap();

    expect(xml).not.toContain("xhtml");
  });

  it("keeps single-locale output free of alternates", () => {
    useSettings({});
    const xml = Sitemap();

    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
    expect(xml).not.toContain("xhtml");
  });
});
