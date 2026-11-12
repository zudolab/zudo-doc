/** @jsxRuntime automatic */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { makeUrlHelpers } from "../../url-helpers/index.js";
import {
  createDocCardNavWrapper,
  resolveDocCards,
  type DocCardSourceDoc,
} from "../index.js";

const DOCS: DocCardSourceDoc[] = [
  { slug: "getting-started/introduction", data: { title: "Introduction", description: "What it is." } },
  { slug: "guides/configuration", data: { title: "Configuration", description: "  " } },
  { slug: "guides/custom", data: { title: "Custom slug page", slug: "guides/renamed" } },
  { slug: "reference/index", data: { title: "Reference", slug: "reference", category_no_page: true } },
];

const base = {
  docs: DOCS,
  locale: "en",
  toRouteSlug: (s: string) => s,
  docsUrl: (slug: string, locale: string) => `/${locale}/docs/${slug}/`,
};

afterEach(() => vi.restoreAllMocks());

describe("resolveDocCards", () => {
  it("keeps request order, dedupes to the first occurrence and reads canonical title/description", () => {
    const { items, diagnostics } = resolveDocCards(
      ["guides/configuration", "getting-started/introduction", "guides/configuration"],
      base,
    );
    expect(items).toEqual([
      { href: "/en/docs/guides/configuration/", title: "Configuration" },
      { href: "/en/docs/getting-started/introduction/", title: "Introduction", description: "What it is." },
    ]);
    expect(diagnostics).toEqual([{ ref: "guides/configuration", reason: "duplicate" }]);
  });

  it("matches a frontmatter slug override, never the content path", () => {
    expect(resolveDocCards(["guides/renamed"], base).items[0]?.title).toBe("Custom slug page");
    expect(resolveDocCards(["guides/custom"], base).diagnostics[0]?.reason).toBe("not-found");
  });

  it("never manufactures links for missing, no-page or invalid references", () => {
    const { items, diagnostics } = resolveDocCards(
      ["missing/page", "reference", "/guides/configuration", 5],
      base,
    );
    expect(items).toEqual([]);
    expect(diagnostics.map((d) => d.reason)).toEqual(["not-found", "no-page", "invalid", "invalid"]);
  });

  it("builds locale, version, base and trailing-slash aware hrefs through the injected helpers", () => {
    const helpers = makeUrlHelpers(
      { base: "/my-docs/", trailingSlash: false, siteUrl: "", defaultLocaleOnlyPrefixes: [] },
      { defaultLocale: "en", locales: ["en", "ja"], getLocaleLabel: (l: string) => l },
    );
    const ja = resolveDocCards(["getting-started/introduction"], {
      ...base,
      locale: "ja",
      docsUrl: helpers.docsUrl,
    });
    expect(ja.items[0]?.href).toBe(helpers.docsUrl("getting-started/introduction", "ja"));
    expect(ja.items[0]?.href.startsWith("/my-docs/ja/")).toBe(true);
    expect(ja.items[0]?.href.endsWith("/")).toBe(false);
    const versioned = resolveDocCards(["getting-started/introduction"], {
      ...base,
      currentVersion: "1.0",
      versionedDocsUrl: (slug, v, lang) => `/v/${v}/${lang}/docs/${slug}/`,
    });
    expect(versioned.items[0]?.href).toBe("/v/1.0/en/docs/getting-started/introduction/");
  });
});

describe("createDocCardNavWrapper", () => {
  function make() {
    const resolveNavSource = vi.fn(() => ({ navDocs: DOCS }));
    const DocCardNav = createDocCardNavWrapper({
      defaultLocale: "en",
      resolveNavSource,
      toRouteSlug: (s) => s,
      docsUrl: (slug, locale) => `/${locale}/docs/${slug}/`,
      versionedDocsUrl: (slug, v, lang) => `/v/${v}/${lang}/docs/${slug}/`,
    });
    return { DocCardNav, resolveNavSource };
  }

  it("resolves against the page locale/version and renders server cards in auto layout", () => {
    const { DocCardNav, resolveNavSource } = make();
    const html = renderSsr(DocCardNav({ docs: ["getting-started/introduction"], lang: "ja", currentVersion: "1.0" }));
    expect(resolveNavSource).toHaveBeenCalledWith("ja", "1.0", { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true });
    expect(html).toContain('href="/v/1.0/ja/docs/getting-started/introduction/"');
    expect(html).toContain('data-layout="auto"');
    expect(html).toContain('aria-label="Selected documents"');
    expect(html).not.toContain("data-zfb-island");
  });

  it("can render the classic two-column grid", () => {
    const { DocCardNav } = make();
    const html = renderSsr(DocCardNav({ docs: ["getting-started/introduction"], layout: "default" }));
    expect(html).not.toContain("data-layout");
    expect(html).toContain("sm:grid-cols-2");
  });

  it("renders nothing for an empty result and warns once per omitted reference", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { DocCardNav } = make();
    expect(DocCardNav({ docs: ["nope", "reference", "nope"] })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]![0])).toContain('[zudo-doc] DocCardNav: "nope"');
  });
});
