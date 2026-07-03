/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import type { ComponentChildren, VNode } from "preact";
import {
  VersionSwitcher,
  VERSION_SWITCHER_INIT_SCRIPT,
  VERSION_SWITCHER_REWIRE_SCRIPT,
  VERSION_SWITCHER_VISIBILITY_STYLE,
  computeVersionSwitcherState,
} from "../version-switcher.js";
import type {
  VersionEntry,
  VersionSwitcherLabels,
} from "../types.js";
import type { VersionSwitcherRewireConfig } from "../version-switcher.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/page-events.js";
import { makeUrlHelpers } from "../../url-helpers/index.js";

type AnyVNode = VNode<{ children?: ComponentChildren; [key: string]: unknown }>;

function isVNode(v: unknown): v is AnyVNode {
  return (
    typeof v === "object" &&
    v !== null &&
    Object.prototype.hasOwnProperty.call(v, "type") &&
    Object.prototype.hasOwnProperty.call(v, "props")
  );
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}

function serialize(node: ComponentChildren): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(serialize).join("");
  if (!isVNode(node)) return "";
  const { type, props } = node;
  const { children, ...rest } = (props ?? {}) as {
    children?: ComponentChildren;
    [key: string]: unknown;
  };

  if (typeof type === "function") {
    const fn = type as (p: typeof props) => ComponentChildren;
    return serialize(fn(props));
  }
  if (type == null || (typeof type === "string" && type === "")) {
    return serialize(children);
  }
  if (typeof type !== "string") return serialize(children);

  const attrs = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => {
      if (k === "key") return "";
      if (v === true) return ` ${k}`;
      return ` ${k}="${escapeAttr(String(v))}"`;
    })
    .join("");

  const voidEls = new Set(["br", "hr", "img", "input", "wbr", "meta", "link"]);
  if (voidEls.has(type)) return `<${type}${attrs}/>`;
  return `<${type}${attrs}>${serialize(children)}</${type}>`;
}

const labels: VersionSwitcherLabels = {
  latest: "Latest",
  switcher: "Version",
  unavailable: "Not available",
  allVersions: "All versions",
};

const versions: VersionEntry[] = [
  { slug: "v2", label: "v2.0" },
  { slug: "v1", label: "v1.x" },
];

const versionUrls: Record<string, string> = {
  v2: "/v/v2/docs/intro/",
  v1: "/v/v1/docs/intro/",
};

describe("VersionSwitcher", () => {
  it("renders the data-version-switcher root, toggle, and menu", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        labels={labels}
      />,
    );
    expect(html).toContain("data-version-switcher");
    expect(html).toContain("data-version-toggle");
    expect(html).toContain("data-version-menu");
    expect(html).toContain('id="version-menu"');
  });

  it("appends idSuffix to the menu id and aria-controls", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        labels={labels}
        idSuffix="header"
      />,
    );
    expect(html).toContain('id="version-menu-header"');
    expect(html).toContain('aria-controls="version-menu-header"');
  });

  it("marks the Latest entry as the active row when no currentVersion is set", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        labels={labels}
      />,
    );
    // Latest link gets aria-current="page" + bold/accent class.
    expect(html).toMatch(/<a[^>]*href="\/docs\/intro\/"[^>]*aria-current="page"/);
    expect(html).toContain("font-bold text-accent");
  });

  it("renders the matching version entry as active when currentVersion is set", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        currentVersion="v1"
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        labels={labels}
      />,
    );
    // The trigger label reflects the current version.
    expect(html).toContain(">v1.x</span>");
    // The v1 list item carries aria-current="page".
    expect(html).toMatch(/href="\/v\/v1\/docs\/intro\/"[^>]*aria-current="page"/);
    // Latest no longer carries it.
    expect(html).not.toMatch(/href="\/docs\/intro\/"[^>]*aria-current="page"/);
  });

  it("renders unavailable versions as disabled, non-interactive links", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        unavailableVersions={new Set(["v1"])}
        labels={labels}
      />,
    );
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("pointer-events-none");
    expect(html).toContain('title="Not available"');
  });

  it("falls back to versionsPageUrl when versionUrls lacks an entry", () => {
    const html = serialize(
      <VersionSwitcher
        versions={[{ slug: "v0", label: "v0" }]}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={{}}
        labels={labels}
      />,
    );
    // Two anchors point at versionsPageUrl: the v0 row and the footer
    // "All versions" link.
    const matches = html.match(/href="\/docs\/versions\/"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("VERSION_SWITCHER_INIT_SCRIPT is non-empty and rebinds on the v2 after-navigate event", () => {
    // The rebind hooks the constant from `transitions/page-events.ts`,
    // not a hard-coded `astro:*` literal — so the script string contains
    // whatever `AFTER_NAVIGATE_EVENT` resolves to today.
    expect(VERSION_SWITCHER_INIT_SCRIPT).toContain(JSON.stringify(AFTER_NAVIGATE_EVENT));
    expect(VERSION_SWITCHER_INIT_SCRIPT).toContain('AbortController');
    expect(VERSION_SWITCHER_INIT_SCRIPT).toContain('data-version-switcher');
  });

  it("does NOT emit an inline <style> (rule moved to consumer global.css per #1505)", () => {
    // Per zudolab/zudo-doc#1505, the inline <style> element that backed
    // responsive visibility was moved out of the component into the
    // consumer's global stylesheet. <style> as a child of <div> violates
    // HTML5's content model and html-validate's element-permitted-content
    // rule. The component now only emits the data-version-switcher root
    // and its dropdown markup; consumers are responsible for shipping the
    // VERSION_SWITCHER_VISIBILITY_STYLE rule in their global.css.
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        labels={labels}
      />,
    );
    expect(html).toContain("data-version-switcher");
    expect(html).not.toContain("<style");
  });

  it("VERSION_SWITCHER_VISIBILITY_STYLE is a self-contained CSS rule for the wrapper", () => {
    // The rule pins onto the `.hidden` baseline that Tailwind always
    // generates (because `pages/` references it directly), so it stays
    // out of the way of any consumer that wraps the switcher without
    // the `hidden lg:block` pattern. The mobile (`< 64rem`) state falls
    // through to the layered `.hidden { display: none }` utility — this
    // string only carries the desktop override.
    expect(VERSION_SWITCHER_VISIBILITY_STYLE).toContain(
      ".hidden:has(> [data-version-switcher])",
    );
    expect(VERSION_SWITCHER_VISIBILITY_STYLE).toContain("@media (min-width:64rem)");
    expect(VERSION_SWITCHER_VISIBILITY_STYLE).toContain("display:block");
    // Mobile has no override here — `.hidden` does that job.
    expect(VERSION_SWITCHER_VISIBILITY_STYLE).not.toContain("display:none");
    // Universal/parent-affecting selector must NOT escape into the
    // bundle: it would force `display:none` on any wrapping element
    // a consumer chose, regardless of intent.
    expect(VERSION_SWITCHER_VISIBILITY_STYLE).not.toContain("*:has(");
  });

  it("emits data-* rewire config + anchor markers when rewireConfig is provided", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        currentVersion="v1"
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        labels={labels}
        idSuffix="header"
        rewireConfig={{
          base: "",
          defaultLocale: "en",
          trailingSlash: true,
          currentLocale: "en",
        }}
      />,
    );
    expect(html).toContain("data-version-rewire");
    expect(html).toContain('data-default-locale="en"');
    expect(html).toContain('data-trailing-slash="true"');
    expect(html).toContain('data-current-locale="en"');
    expect(html).toContain("data-version-latest");
    expect(html).toContain("data-version-trigger-label");
    expect(html).toContain('data-version-slug="v1"');
    expect(html).toContain('data-version-slug="v2"');
  });

  it("omits rewire markers for a static render (no rewireConfig)", () => {
    const html = serialize(
      <VersionSwitcher
        versions={versions}
        latestUrl="/docs/intro/"
        versionsPageUrl="/docs/versions/"
        versionUrls={versionUrls}
        labels={labels}
      />,
    );
    expect(html).not.toContain("data-version-rewire");
    expect(html).not.toContain("data-version-latest");
    expect(html).not.toContain("data-version-slug");
    expect(html).not.toContain("data-version-trigger-label");
  });
});

// ---------------------------------------------------------------------------
// SPA re-wire (#2553): the client transform must reproduce the SSR-baked
// header menu (latestUrl / versionUrls / active version) exactly, so a
// persisted header's version switcher stays correct after same-locale
// navigation. This pins computeVersionSwitcherState to the header factory's
// URL logic (createHeaderWithDefaults's latestUrl/versionUrls block, in turn
// makeUrlHelpers' docsUrl / versionedDocsUrl / withBase).
// ---------------------------------------------------------------------------
describe("computeVersionSwitcherState (client re-wire) matches SSR header menu", () => {
  const i18n = {
    defaultLocale: "en",
    locales: ["en", "ja"],
    getLocaleLabel: (c: string) => c.toUpperCase(),
  };

  const versionSlugs = ["1.0", "2.0"];

  /**
   * Reproduce the exact per-page menu the header factory builds
   * (header-with-defaults/index.tsx) from (currentSlug, currentVersion, lang).
   */
  function ssrHeaderMenu(
    helpers: ReturnType<typeof makeUrlHelpers>,
    lang: string,
    currentSlug: string | undefined,
    currentVersion: string | undefined,
  ) {
    const isNonDefaultLocale = lang !== i18n.defaultLocale;
    const versionsPageUrl = helpers.withBase(
      isNonDefaultLocale ? `/${lang}/docs/versions` : "/docs/versions",
    );
    const latestUrl =
      currentSlug != null ? helpers.docsUrl(currentSlug, lang) : versionsPageUrl;
    const versionUrls: Record<string, string> = {};
    for (const v of versionSlugs) {
      versionUrls[v] =
        currentSlug != null
          ? helpers.versionedDocsUrl(currentSlug, v, lang)
          : versionsPageUrl;
    }
    return { latestUrl, versionUrls, activeVersion: currentVersion ?? null };
  }

  const cases: Array<{
    label: string;
    base: string;
    trailingSlash: boolean;
    lang: string;
    // A doc page carries currentSlug; the /docs/versions listing + non-doc
    // pages pass currentSlug undefined (all links collapse to versionsPageUrl).
    currentSlug: string | undefined;
    currentVersion: string | undefined;
    // How the SSR router builds this page's own pathname.
    pathnameFor: (h: ReturnType<typeof makeUrlHelpers>) => string;
  }> = [
    {
      label: "latest, default locale, deep slug",
      base: "/",
      trailingSlash: true,
      lang: "en",
      currentSlug: "guides/getting-started",
      currentVersion: undefined,
      pathnameFor: (h) => h.docsUrl("guides/getting-started", "en"),
    },
    {
      label: "versioned, default locale",
      base: "/",
      trailingSlash: true,
      lang: "en",
      currentSlug: "getting-started",
      currentVersion: "1.0",
      pathnameFor: (h) => h.versionedDocsUrl("getting-started", "1.0", "en"),
    },
    {
      label: "versioned, non-default locale",
      base: "/",
      trailingSlash: true,
      lang: "ja",
      currentSlug: "guide/intro",
      currentVersion: "2.0",
      pathnameFor: (h) => h.versionedDocsUrl("guide/intro", "2.0", "ja"),
    },
    {
      label: "latest, non-default locale, docs root (empty slug)",
      base: "/",
      trailingSlash: true,
      lang: "ja",
      currentSlug: "",
      currentVersion: undefined,
      pathnameFor: (h) => h.docsUrl("", "ja"),
    },
    {
      label: "versions index, default locale (no currentSlug)",
      base: "/",
      trailingSlash: true,
      lang: "en",
      currentSlug: undefined,
      currentVersion: undefined,
      pathnameFor: (h) => h.withBase("/docs/versions"),
    },
    {
      label: "versions index, non-default locale (no currentSlug)",
      base: "/",
      trailingSlash: true,
      lang: "ja",
      currentSlug: undefined,
      currentVersion: undefined,
      pathnameFor: (h) => h.withBase("/ja/docs/versions"),
    },
    {
      label: "with base prefix, versioned",
      base: "/app",
      trailingSlash: true,
      lang: "en",
      currentSlug: "x",
      currentVersion: "2.0",
      pathnameFor: (h) => h.versionedDocsUrl("x", "2.0", "en"),
    },
    {
      label: "trailingSlash off, latest",
      base: "/",
      trailingSlash: false,
      lang: "en",
      currentSlug: "x",
      currentVersion: undefined,
      pathnameFor: (h) => h.docsUrl("x", "en"),
    },
  ];

  for (const tc of cases) {
    it(`reproduces SSR menu: ${tc.label}`, () => {
      const helpers = makeUrlHelpers(
        {
          base: tc.base,
          trailingSlash: tc.trailingSlash,
          siteUrl: "",
          defaultLocaleOnlyPrefixes: [],
        },
        i18n,
      );
      const pathname = tc.pathnameFor(helpers);
      const ssr = ssrHeaderMenu(helpers, tc.lang, tc.currentSlug, tc.currentVersion);

      const config: VersionSwitcherRewireConfig = {
        base: tc.base.replace(/\/+$/, ""),
        defaultLocale: i18n.defaultLocale,
        trailingSlash: tc.trailingSlash,
        currentLocale: tc.lang,
      };
      const client = computeVersionSwitcherState(pathname, config, versionSlugs);

      expect(client.latestHref, `${tc.label} → latest`).toBe(ssr.latestUrl);
      for (const v of versionSlugs) {
        expect(client.versionHrefs[v], `${tc.label} → ${v}`).toBe(ssr.versionUrls[v]);
      }
      expect(client.activeVersion, `${tc.label} → active`).toBe(ssr.activeVersion);
    });
  }
});

describe("VERSION_SWITCHER_REWIRE_SCRIPT", () => {
  it("is non-empty, rebinds on after-navigate, embeds the state fn, and is idempotent", () => {
    expect(VERSION_SWITCHER_REWIRE_SCRIPT.length).toBeGreaterThan(0);
    expect(VERSION_SWITCHER_REWIRE_SCRIPT).toContain(JSON.stringify(AFTER_NAVIGATE_EVENT));
    expect(VERSION_SWITCHER_REWIRE_SCRIPT).toContain("data-version-rewire");
    expect(VERSION_SWITCHER_REWIRE_SCRIPT).toContain("computeVersionSwitcherState");
    expect(VERSION_SWITCHER_REWIRE_SCRIPT).toContain("window.location.pathname");
    // idempotency guard (single document-level listener per page lifetime)
    expect(VERSION_SWITCHER_REWIRE_SCRIPT).toContain("__zdVersionSwitcherRewire");
  });
});
