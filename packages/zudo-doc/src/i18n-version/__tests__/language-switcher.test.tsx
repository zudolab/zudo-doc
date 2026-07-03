/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import type { ComponentChildren, VNode } from "preact";
import {
  LanguageSwitcher,
  LANGUAGE_SWITCHER_INIT_SCRIPT,
  switchLocaleHref,
} from "../language-switcher.js";
import type { LocaleLink } from "../types.js";
import { makeUrlHelpers } from "../../url-helpers/index.js";
import { AFTER_NAVIGATE_EVENT } from "../../transitions/index.js";

// Minimal VNode → HTML serializer (mirrors the helper used in
// breadcrumb.test.tsx — kept inline so the test runs without a render
// dependency).
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

const enJa: LocaleLink[] = [
  { code: "en", label: "EN", href: "/docs/", active: true },
  { code: "ja", label: "JA", href: "/ja/docs/", active: false },
];

describe("LanguageSwitcher", () => {
  it("returns null when there is one or fewer links (matches the Astro guard)", () => {
    const noneRendered =
      LanguageSwitcher({ links: [] as LocaleLink[] }) === null;
    const oneRendered =
      LanguageSwitcher({ links: enJa.slice(0, 1) }) === null;
    expect(noneRendered).toBe(true);
    expect(oneRendered).toBe(true);
  });

  it("renders a span (not an anchor) for the active locale with aria-current", () => {
    const html = serialize(<LanguageSwitcher links={enJa} />);
    expect(html).toContain('<span aria-current="true"');
    expect(html).toContain(">EN</span>");
  });

  it("renders an anchor with the lang attribute for inactive locales", () => {
    const html = serialize(<LanguageSwitcher links={enJa} />);
    expect(html).toContain('href="/ja/docs/"');
    expect(html).toContain('lang="ja"');
    expect(html).toContain(">JA</a>");
  });

  it("inserts a slash separator between every pair of links", () => {
    const enJaFr: LocaleLink[] = [
      ...enJa,
      { code: "fr", label: "FR", href: "/fr/docs/", active: false },
    ];
    const html = serialize(<LanguageSwitcher links={enJaFr} />);
    // Two separators for three links.
    const slashCount = (html.match(/<span class="text-muted">\/<\/span>/g) ?? []).length;
    expect(slashCount).toBe(2);
  });

  it("emits data-* config on the container when config is provided", () => {
    const html = serialize(
      <LanguageSwitcher
        links={enJa}
        config={{ base: "", defaultLocale: "en", trailingSlash: true }}
        currentLocale="ja"
      />,
    );
    expect(html).toContain("data-language-switcher");
    expect(html).toContain('data-current-locale="ja"');
    expect(html).toContain('data-default-locale="en"');
    expect(html).toContain('data-trailing-slash="true"');
  });

  it("omits config attributes for a static render (no config)", () => {
    const html = serialize(<LanguageSwitcher links={enJa} />);
    expect(html).not.toContain("data-language-switcher");
  });
});

// ---------------------------------------------------------------------------
// SPA re-wire (#2551): the client transform must reproduce the SSR-baked
// hrefs exactly, so a persisted header's switcher stays correct after
// same-locale navigation.
// ---------------------------------------------------------------------------
describe("switchLocaleHref (client re-wire) matches SSR buildLocaleLinks", () => {
  const i18n = {
    defaultLocale: "en",
    locales: ["en", "ja", "de"],
    getLocaleLabel: (c: string) => c.toUpperCase(),
  };

  const cases: Array<{
    label: string;
    base: string;
    trailingSlash: boolean;
    pathname: string;
    currentLang: string;
  }> = [
    { label: "non-default → default (ja deep page)", base: "/", trailingSlash: true, pathname: "/ja/docs/guides/sidebar-filter/", currentLang: "ja" },
    { label: "default → non-default (en deep page)", base: "/", trailingSlash: true, pathname: "/docs/guides/sidebar-filter/", currentLang: "en" },
    { label: "locale index (ja root)", base: "/", trailingSlash: true, pathname: "/ja/docs/", currentLang: "ja" },
    { label: "versioned non-default", base: "/", trailingSlash: true, pathname: "/v/1.0/ja/docs/intro/", currentLang: "ja" },
    { label: "versioned default", base: "/", trailingSlash: true, pathname: "/v/1.0/docs/intro/", currentLang: "en" },
    { label: "with base prefix", base: "/app", trailingSlash: true, pathname: "/app/ja/docs/x/", currentLang: "ja" },
    { label: "trailingSlash off", base: "/", trailingSlash: false, pathname: "/ja/docs/x", currentLang: "ja" },
  ];

  for (const tc of cases) {
    it(`reproduces SSR hrefs: ${tc.label}`, () => {
      const helpers = makeUrlHelpers(
        { base: tc.base, trailingSlash: tc.trailingSlash, siteUrl: "", defaultLocaleOnlyPrefixes: [] },
        i18n,
      );
      const config = {
        base: tc.base.replace(/\/+$/, ""),
        defaultLocale: "en",
        trailingSlash: tc.trailingSlash,
      };
      const links = helpers.buildLocaleLinks(tc.pathname, tc.currentLang);
      // Need >1 rendered link so there are inactive anchors to re-wire.
      expect(links.length).toBeGreaterThan(1);
      for (const link of links) {
        if (link.active) continue;
        expect(
          switchLocaleHref(tc.pathname, config, tc.currentLang, link.code),
          `${tc.label} → ${link.code}`,
        ).toBe(link.href);
      }
    });
  }

  it("default-locale-only pages render one (active) link — nothing to re-wire", () => {
    const helpers = makeUrlHelpers(
      { base: "/", trailingSlash: true, siteUrl: "", defaultLocaleOnlyPrefixes: ["/docs/versions/"] },
      i18n,
    );
    const links = helpers.buildLocaleLinks("/ja/docs/versions/", "ja");
    expect(links.length).toBe(1);
    expect(links[0]?.active).toBe(true);
  });
});

describe("LANGUAGE_SWITCHER_INIT_SCRIPT", () => {
  it("is non-empty, rebinds on after-navigate, and is idempotent", () => {
    expect(LANGUAGE_SWITCHER_INIT_SCRIPT.length).toBeGreaterThan(0);
    expect(LANGUAGE_SWITCHER_INIT_SCRIPT).toContain(JSON.stringify(AFTER_NAVIGATE_EVENT));
    expect(LANGUAGE_SWITCHER_INIT_SCRIPT).toContain("data-language-switcher");
    expect(LANGUAGE_SWITCHER_INIT_SCRIPT).toContain("switchLocaleHref");
    expect(LANGUAGE_SWITCHER_INIT_SCRIPT).toContain("window.location.pathname");
    // idempotency guard (single document-level listener per page lifetime)
    expect(LANGUAGE_SWITCHER_INIT_SCRIPT).toContain("__zdLanguageSwitcherInit");
  });
});
