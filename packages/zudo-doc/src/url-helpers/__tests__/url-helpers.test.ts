import { describe, it, expect } from "vitest";
import { makeUrlHelpers, type UrlHelperSettings } from "../index.js";
import type { FactoryI18n } from "../../factory-context/index.js";

// Fixture mirroring the showcase wiring: base "/", trailingSlash on, en default
// + ja locale, one default-locale-only prefix.
const baseSettings: UrlHelperSettings = {
  base: "/",
  trailingSlash: true,
  siteUrl: "https://example.com",
  defaultLocaleOnlyPrefixes: ["/docs/claude-md/"],
};

const i18n: FactoryI18n = {
  defaultLocale: "en",
  locales: ["en", "ja"],
  getLocaleLabel: (l) => l.toUpperCase(),
};

function helpers(overrides: Partial<UrlHelperSettings> = {}) {
  return makeUrlHelpers({ ...baseSettings, ...overrides }, i18n);
}

describe("normalizedBase + withBase", () => {
  it("normalizes a '/' base to empty string", () => {
    expect(helpers().normalizedBase).toBe("");
  });

  it("prefixes paths when base is a sub-path and appends trailing slash", () => {
    const h = helpers({ base: "/app/" });
    expect(h.normalizedBase).toBe("/app");
    expect(h.withBase("/docs/x")).toBe("/app/docs/x/");
  });

  it("does not append a trailing slash to file-extension paths", () => {
    expect(helpers().withBase("/sitemap.xml")).toBe("/sitemap.xml");
  });

  it("omits the trailing slash when trailingSlash is false", () => {
    expect(helpers({ trailingSlash: false }).withBase("/docs/x")).toBe("/docs/x");
  });
});

describe("navHref", () => {
  const h = helpers();
  it("default locale, no version", () => {
    expect(h.navHref("/docs/getting-started", "en", undefined)).toBe("/docs/getting-started/");
  });
  it("non-default locale inserts locale prefix", () => {
    expect(h.navHref("/docs/getting-started", "ja", undefined)).toBe("/ja/docs/getting-started/");
  });
  it("version prefix precedes locale", () => {
    expect(h.navHref("/docs/getting-started", "ja", "1.0")).toBe("/v/1.0/ja/docs/getting-started/");
  });
  it("undefined lang is treated as default locale", () => {
    expect(h.navHref("/docs/guides", undefined, "1.0")).toBe("/v/1.0/docs/guides/");
  });
});

describe("getPathForLocale", () => {
  const h = helpers();
  it("adds locale prefix en → ja", () => {
    expect(h.getPathForLocale("/docs/x/", "en", "ja")).toBe("/ja/docs/x/");
  });
  it("removes locale prefix ja → en", () => {
    expect(h.getPathForLocale("/ja/docs/x/", "ja", "en")).toBe("/docs/x/");
  });
  it("keeps a versioned JA path intact ja → ja", () => {
    expect(h.getPathForLocale("/v/1.0/ja/docs/x/", "ja", "ja")).toBe("/v/1.0/ja/docs/x/");
  });
});

describe("isDefaultLocaleOnlyPath", () => {
  const h = helpers();
  it("true for a configured prefix", () => {
    expect(h.isDefaultLocaleOnlyPath("/docs/claude-md/")).toBe(true);
  });
  it("false for an unconfigured path", () => {
    expect(h.isDefaultLocaleOnlyPath("/docs/guides/")).toBe(false);
  });
});

describe("buildLocaleLinks", () => {
  const h = helpers();
  it("returns one link for a default-locale-only deep path", () => {
    const links = h.buildLocaleLinks("/docs/claude-md/x/", "en");
    expect(links).toHaveLength(1);
    expect(links[0]?.code).toBe("en");
    expect(links[0]?.active).toBe(true);
  });
  it("returns all locales for a bilingual page with routed hrefs", () => {
    const links = h.buildLocaleLinks("/v/1.0/ja/docs/x/", "ja");
    expect(links.find((l) => l.code === "en")?.href).toBe("/v/1.0/docs/x/");
    expect(links.find((l) => l.code === "ja")?.href).toBe("/v/1.0/ja/docs/x/");
    expect(links.find((l) => l.code === "ja")?.active).toBe(true);
  });
});

describe("docsUrl / versionedDocsUrl / absoluteUrl / resolveHref", () => {
  const h = helpers();
  it("docsUrl honors locale", () => {
    expect(h.docsUrl("guides", "en")).toBe("/docs/guides/");
    expect(h.docsUrl("guides", "ja")).toBe("/ja/docs/guides/");
  });
  it("versionedDocsUrl nests locale after version", () => {
    expect(h.versionedDocsUrl("guides", "1.0", "ja")).toBe("/v/1.0/ja/docs/guides/");
  });
  it("absoluteUrl joins siteUrl, undefined when empty", () => {
    expect(h.absoluteUrl("/docs/x/")).toBe("https://example.com/docs/x/");
    expect(helpers({ siteUrl: "" }).absoluteUrl("/docs/x/")).toBeUndefined();
  });
  it("resolveHref passes external URLs through", () => {
    expect(h.resolveHref("https://x.test/y")).toBe("https://x.test/y");
    expect(h.resolveHref("/docs/x")).toBe("/docs/x/");
  });
});
