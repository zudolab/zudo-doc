/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { render } from "preact-render-to-string";

import { createChrome } from "../chrome/index.js";
import { createRouteContext } from "../route-context/index.js";
import {
  createRouteContextPayload,
  type ThemePacksCatalogManifest,
} from "../route-context-payload/index.js";
import type { ChromeHostBindings } from "../factory-context/index.js";
import type { DocPageEntry } from "../doc-page-props/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "../..");
const REPO_ROOT = resolve(PKG_ROOT, "../..");
const SRC_ENTRY = resolve(PKG_ROOT, "src/route-context-payload/index.ts");
const DIST_DTS = resolve(PKG_ROOT, "dist/route-context-payload/index.d.ts");

interface BrowserGraph {
  analyzeDeclarationGraph(entry: string): {
    violations: Array<{ specifier: string; label: string; importer: string }>;
    files: string[];
  };
  analyzeSiteSchemaGraph(args: {
    entry: string;
    resolveFrom: string[];
  }): Promise<{
    violations: Array<{ specifier: string; label: string; importer: string }>;
    specifiers: string[];
  }>;
}

async function loadGraphHelper(): Promise<BrowserGraph> {
  const url = pathToFileURL(resolve(PKG_ROOT, "scripts/site-schema-graph.mjs")).href;
  return (await import(/* @vite-ignore */ url)) as BrowserGraph;
}

function makeCatalog(): ThemePacksCatalogManifest {
  const swatches = {
    bg: "#fff",
    fg: "#000",
    accent: "#f60",
    syntax: {
      keyword: "#00f",
      string: "#080",
      comment: "#777",
      callable: "#808",
    },
  };
  return {
    schemaVersion: 2,
    packs: [
      {
        slug: "default",
        hasStylesheet: false,
        meta: {
          schemaVersion: 1,
          slug: "default",
          name: "Default",
          description: "Default theme",
          mode: "light",
          version: "1.0.0",
          fonts: { sans: "system-ui", mono: "monospace", loaded: [] },
          preview: { light: swatches, dark: swatches },
        },
      },
    ],
  };
}

describe("createRouteContextPayload", () => {
  it("maps plain site data, applies documented merge semantics, and builds the registry", () => {
    const customSchemes = {};
    const payload = createRouteContextPayload({
      siteTitle: "Browser Docs",
      description: "Live author preview",
      defaultLocale: "en",
      locales: { ja: { label: "日本語", dir: "content/ja" } },
      categories: [{ label: "Guides", path: "guides" }],
      themePack: "default",
      catalog: makeCatalog(),
      translations: {
        en: { "search.label": "Find" },
        fr: { "search.label": "Rechercher" },
      },
      settings: { base: "/preview/", siteDescription: "settings wins" },
      tagVocabulary: [{ id: "browser" }],
      colorSchemes: customSchemes,
      assetManifest: {
        dir: "assets",
        routePrefix: "files",
        entries: [],
        excerpts: {},
      },
    });

    expect(payload.settings).toMatchObject({
      siteName: "Browser Docs",
      siteDescription: "settings wins",
      defaultLocale: "en",
      locales: { ja: { label: "日本語", dir: "content/ja" } },
      headerNav: [{ label: "Guides", path: "guides" }],
      themePack: "default",
      base: "/preview/",
      tocMinDepth: 2,
    });
    expect(payload.translations.en?.["search.label"]).toBe("Find");
    expect(payload.translations.en?.["nav.next"]).toBe("Next");
    expect(payload.translations.ja?.["nav.next"]).toBe("次へ");
    expect(payload.translations.fr).toEqual({ "search.label": "Rechercher" });
    expect(payload.tagVocabulary).toEqual([{ id: "browser" }]);
    expect(payload.colorSchemes).toBe(customSchemes);
    expect(payload.themePackRegistry?.map((entry) => entry.slug)).toEqual([
      "default",
    ]);
    expect(payload.assetManifest?.routePrefix).toBe("files");
  });

  it("defaults package data and makes a missing or explicitly null registry inert", () => {
    const omitted = createRouteContextPayload({ siteTitle: "Defaults" });
    const explicit = createRouteContextPayload({
      siteTitle: "Defaults",
      catalog: makeCatalog(),
      themePackRegistry: null,
    });

    expect(omitted.settings.siteDescription).toBe("");
    expect(omitted.translations.en?.["nav.next"]).toBe("Next");
    expect(omitted.colorSchemes).toHaveProperty("Default Dark");
    expect(omitted.themePackRegistry).toBeNull();
    expect(omitted.assetManifest).toBeNull();
    expect(explicit.themePackRegistry).toBeNull();
    expect(explicit.assetManifest).toBeNull();
  });

  it("is accepted by createRouteContext with caller stableDocs and renders a page to string", () => {
    const entry = {
      id: "guides/browser",
      slug: "guides/browser",
      collection: "docs",
      module_specifier: "guides/browser.mdx",
      data: { title: "Browser rendering", description: "Rendered without a build" },
      Content: () => <article data-browser-content>Browser body</article>,
    } as unknown as DocPageEntry;
    const stableDocsCalls: string[] = [];
    const routeContext = createRouteContext(
      createRouteContextPayload({
        siteTitle: "Browser Docs",
        categories: [{ label: "Guides", path: "guides", categoryMatch: "guides" }],
        catalog: makeCatalog(),
      }),
      {
        stableDocs(collectionName) {
          stableDocsCalls.push(collectionName);
          return [entry];
        },
      },
    );
    const hostBindings: ChromeHostBindings = {
      Header: () => <header data-browser-header />,
      Footer: () => <footer data-browser-footer />,
      Sidebar: () => <aside data-browser-sidebar />,
      Toc: () => <nav data-browser-toc />,
      Breadcrumb: () => <nav data-browser-breadcrumb />,
      DocPager: () => <nav data-browser-pager />,
    };
    expect(routeContext.stableDocs("docs")).toEqual([entry]);
    const chrome = createChrome(routeContext, hostBindings);
    const vnode = chrome.renderDocPage(
      {
        kind: "entry",
        entry,
        breadcrumbs: [{ label: "Browser rendering" }],
        prev: null,
        next: null,
        headings: [],
      },
      { locale: "en" },
    );
    const html = render(vnode);

    expect(html).toContain("data-browser-header");
    expect(html).toContain("data-browser-content");
    expect(html).toContain("Browser body");
    expect(stableDocsCalls.length).toBeGreaterThan(0);
  });
});

describe("createRouteContext translation precedence", () => {
  const accessibleLabelKey = "language.switcher.label";

  function makeContext(
    translations: Record<string, Record<string, string>> = {},
  ) {
    return createRouteContext(
      createRouteContextPayload({
        siteTitle: "Fallback Docs",
        defaultLocale: "fr",
        locales: { de: { label: "Deutsch", dir: "content/de" } },
        translations,
      }),
      { stableDocs: () => [] },
    );
  }

  it("prefers a requested DE value over the configured default and English", () => {
    const routeContext = makeContext({
      fr: { [accessibleLabelKey]: "Langue" },
      de: { [accessibleLabelKey]: "Sprache (custom)" },
    });

    expect(routeContext.t(accessibleLabelKey, "de")).toBe("Sprache (custom)");
  });

  it("uses a configured-default override before package English", () => {
    const routeContext = makeContext({
      fr: { [accessibleLabelKey]: "Langue" },
    });

    expect(routeContext.t(accessibleLabelKey, "es")).toBe("Langue");
  });

  it("falls back to package English for a custom primary and a partial locale", () => {
    const routeContext = makeContext({
      fr: { "custom.only": "Personnalisé" },
      de: { [accessibleLabelKey]: "Sprache (custom)" },
    });

    expect(routeContext.t(accessibleLabelKey, "fr")).toBe("Language");
    expect(routeContext.t("asset.badge", "de")).toBe("Asset");
  });

  it("retains the bundled English fallback when a raw payload omits English", () => {
    const defaults = createRouteContextPayload({
      siteTitle: "Fallback Docs",
      defaultLocale: "fr",
      locales: { de: { label: "Deutsch", dir: "content/de" } },
    });
    const routeContext = createRouteContext(
      {
        settings: defaults.settings,
        translations: { fr: {}, de: {} },
        tagVocabulary: [],
        colorSchemes: null,
        themePackRegistry: null,
      },
      { stableDocs: () => [] },
    );

    expect(routeContext.t(accessibleLabelKey, "fr")).toBe("Language");
  });

  it("keeps a project English override ahead of the bundled English value", () => {
    const routeContext = makeContext({
      en: { [accessibleLabelKey]: "Locale" },
    });

    expect(routeContext.t(accessibleLabelKey, "es")).toBe("Locale");
  });

  it("returns the raw key when no locale contains it", () => {
    const routeContext = makeContext({});

    expect(routeContext.t("missing.translation.key", "de")).toBe(
      "missing.translation.key",
    );
  });

  it("keeps the existing English and Japanese values", () => {
    const routeContext = makeContext();

    expect(routeContext.t(accessibleLabelKey, "en")).toBe("Language");
    expect(routeContext.t(accessibleLabelKey, "ja")).toBe("言語");
  });
});

describe("./route-context-payload browser safety", () => {
  it("bundles the source under platform neutral with no forbidden runtime specifiers", async () => {
    const { analyzeSiteSchemaGraph } = await loadGraphHelper();
    const { violations, specifiers } = await analyzeSiteSchemaGraph({
      entry: SRC_ENTRY,
      resolveFrom: [PKG_ROOT, REPO_ROOT, __dirname],
    });

    expect(
      violations,
      violations.map((v) => `${v.specifier} (${v.label}) via ${v.importer}`).join("\n"),
    ).toEqual([]);
    expect(specifiers.length).toBeGreaterThan(0);
  });

  it("keeps its emitted declaration graph free of forbidden specifiers", async () => {
    expect(existsSync(DIST_DTS), `${DIST_DTS} missing — run package build`).toBe(true);
    const { analyzeDeclarationGraph } = await loadGraphHelper();
    const { violations, files } = analyzeDeclarationGraph(DIST_DTS);

    expect(
      violations,
      violations.map((v) => `${v.specifier} (${v.label}) in ${v.importer}`).join("\n"),
    ).toEqual([]);
    expect(files.length).toBeGreaterThan(1);
  });

  it("is exported exactly and included in the prepack contract", () => {
    const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
      scripts: Record<string, string>;
    };
    expect(pkg.exports["./route-context-payload"]).toEqual({
      types: "./dist/route-context-payload/index.d.ts",
      default: "./dist/route-context-payload/index.js",
    });
    expect(pkg.scripts["check:prepack-contract"]).toContain(
      "check-route-context-payload.mjs",
    );
  });
});
