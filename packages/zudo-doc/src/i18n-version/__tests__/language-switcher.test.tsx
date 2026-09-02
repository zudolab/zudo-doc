/** @vitest-environment happy-dom */
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
import {
  CURRENT_PATH_DATASET_KEY,
  CURRENT_PATH_SCRIPT_PRELUDE,
} from "../../current-path/index.js";

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
      LanguageSwitcher({ links: [] as LocaleLink[], accessibleLabel: "Language" }) === null;
    const oneRendered =
      LanguageSwitcher({ links: enJa.slice(0, 1), accessibleLabel: "Language" }) === null;
    expect(noneRendered).toBe(true);
    expect(oneRendered).toBe(true);
  });

  it("renders a span (not an anchor) for the active locale with aria-current", () => {
    const html = serialize(
      <LanguageSwitcher links={enJa} accessibleLabel="Language" />,
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('lang="en"');
    expect(html).toContain(">EN</span>");
  });

  it("renders an anchor with the lang attribute for inactive locales", () => {
    const html = serialize(
      <LanguageSwitcher links={enJa} accessibleLabel="Language" />,
    );
    expect(html).toContain('href="/ja/docs/"');
    expect(html).toContain('lang="ja"');
    expect(html).toContain(">JA</a>");
  });

  it("renders every configured locale in order inside the disclosure", () => {
    const enJaDe: LocaleLink[] = [
      ...enJa,
      { code: "de", label: "DE", href: "/de/docs/", active: false },
    ];
    const html = serialize(
      <LanguageSwitcher links={enJaDe} accessibleLabel="Language" />,
    );
    expect(html.indexOf(">EN</span>")).toBeLessThan(html.indexOf(">JA</a>"));
    expect(html.indexOf(">JA</a>")).toBeLessThan(html.indexOf(">DE</a>"));
    // The absence of role="menu" is deliberate, not an oversight
    // (zudolab/zudo-doc#3927) — this is a W3C APG disclosure-navigation
    // widget, not a menu. Full rationale sits at the `<ul>` in
    // language-switcher.tsx, where the temptation to add the role lives.
    expect(html).not.toContain("role=\"menu\"");
  });

  it("names the disclosure list from its trigger, with ids resolving both ways", () => {
    const cases: Array<{
      idSuffix?: string;
      toggleId: string;
      menuId: string;
    }> = [
      {
        idSuffix: "header",
        toggleId: "language-toggle-header",
        menuId: "language-menu-header",
      },
      { toggleId: "language-toggle", menuId: "language-menu" },
    ];

    for (const { idSuffix, toggleId, menuId } of cases) {
      const host = document.createElement("div");
      host.innerHTML = serialize(
        <LanguageSwitcher
          links={enJa}
          accessibleLabel="言語"
          idSuffix={idSuffix}
        />,
      );

      const toggle = host.querySelector<HTMLButtonElement>(
        "[data-language-toggle]",
      )!;
      const menu = host.querySelector<HTMLElement>("[data-language-menu]")!;

      expect(toggle.id).toBe(toggleId);
      expect(menu.id).toBe(menuId);
      // Assert the whole relationship on one rendered instance: each aria-*
      // reference must resolve to the *other* element, which is what makes
      // the list's accessible name come from the trigger's aria-label.
      expect(
        host.querySelector(`#${toggle.getAttribute("aria-controls")}`),
      ).toBe(menu);
      expect(
        host.querySelector(`#${menu.getAttribute("aria-labelledby")}`),
      ).toBe(toggle);
      expect(toggle.getAttribute("aria-label")).toBe("言語");
    }
  });

  it("uses the configured active label and exposes accessible disclosure state", () => {
    const html = serialize(
      <LanguageSwitcher
        links={[
          { ...enJa[0]!, label: "English", active: false },
          { ...enJa[1]!, label: "日本語", active: true },
        ]}
        accessibleLabel="言語"
        idSuffix="header"
      />,
    );
    expect(html).toContain(">日本語</span>");
    expect(html).toContain('aria-label="言語"');
    expect(html).toContain('aria-controls="language-menu-header"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('id="language-menu-header"');
    expect(html).toContain("<svg");

    const shortLabelHtml = serialize(
      <LanguageSwitcher
        links={[
          { ...enJa[0]!, active: false },
          { ...enJa[1]!, label: "JP", active: true },
        ]}
        accessibleLabel="Language"
      />,
    );
    expect(shortLabelHtml).toContain(">JP</span>");
    expect(shortLabelHtml).toContain("<svg");
  });

  it("keeps trigger/menu linkage unique when callers provide distinct suffixes", () => {
    const first = serialize(
      <LanguageSwitcher links={enJa} accessibleLabel="Language" idSuffix="header-a" />,
    );
    const second = serialize(
      <LanguageSwitcher links={enJa} accessibleLabel="Language" idSuffix="header-b" />,
    );
    expect(first).toContain('aria-controls="language-menu-header-a"');
    expect(second).toContain('aria-controls="language-menu-header-b"');
    expect(first).not.toContain("language-menu-header-b");
  });

  it("emits data-* config on the container when config is provided", () => {
    const html = serialize(
      <LanguageSwitcher
        links={enJa}
        accessibleLabel="Language"
        config={{ base: "", defaultLocale: "en", trailingSlash: true }}
        currentLocale="ja"
      />,
    );
    expect(html).toContain("data-language-switcher");
    expect(html).toContain('data-current-locale="ja"');
    expect(html).toContain('data-default-locale="en"');
    expect(html).toContain('data-trailing-slash="true"');
  });

  it("keeps the interaction marker but omits rewire config for a static render", () => {
    const html = serialize(
      <LanguageSwitcher links={enJa} accessibleLabel="Language" />,
    );
    expect(html).toContain("data-language-switcher");
    expect(html).not.toContain("data-default-locale");
    expect(html).toContain("group-hover:block");
    expect(html).toContain("group-focus-within:block");
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
    // Explicit current-route override read order (zudolab/zudo-doc#3398):
    // dataset attribute first, location.pathname as the fallback default. The
    // reader is spliced in from current-path/index.ts (#3408); the executing
    // proof lives in current-path/__tests__/current-path-surfaces.test.tsx.
    expect(LANGUAGE_SWITCHER_INIT_SCRIPT).toContain(CURRENT_PATH_SCRIPT_PRELUDE);
    expect(LANGUAGE_SWITCHER_INIT_SCRIPT).toContain("location.pathname");
    // idempotency guard (single document-level listener per page lifetime)
    expect(LANGUAGE_SWITCHER_INIT_SCRIPT).toContain("__zdLanguageSwitcherInit");
  });

  it("handles disclosure interaction, navigation reset, rewiring, and repeated init safely", () => {
    const links: LocaleLink[] = [
      { code: "en", label: "English", href: "#en", active: false },
      { code: "ja", label: "日本語", href: "#ja", active: true },
      { code: "de", label: "Deutsch", href: "#de", active: false },
    ];
    document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = "/ja/docs/first";
    document.body.innerHTML = serialize(
      <LanguageSwitcher
        links={links}
        accessibleLabel="言語"
        idSuffix="header"
        config={{ base: "", defaultLocale: "en", trailingSlash: false }}
        currentLocale="ja"
      />,
    );

    new Function(LANGUAGE_SWITCHER_INIT_SCRIPT)();

    const switcher = document.querySelector<HTMLElement>("[data-language-switcher]")!;
    const toggle = switcher.querySelector<HTMLButtonElement>("[data-language-toggle]")!;
    const menu = switcher.querySelector<HTMLElement>("[data-language-menu]")!;
    expect(menu.classList.contains("group-hover:block")).toBe(false);
    expect(menu.classList.contains("group-focus-within:block")).toBe(false);
    expect(switcher.querySelector('a[lang="en"]')?.getAttribute("href")).toBe(
      "/docs/first",
    );
    expect(switcher.querySelector('a[lang="de"]')?.getAttribute("href")).toBe(
      "/de/docs/first",
    );

    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(menu.classList.contains("hidden")).toBe(false);

    const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    toggle.dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const firstLocaleLink = menu.querySelector<HTMLAnchorElement>("a[lang]")!;
    expect(
      Boolean(toggle.compareDocumentPosition(firstLocaleLink) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    firstLocaleLink.focus();
    expect(document.activeElement).toBe(firstLocaleLink);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(menu.classList.contains("hidden")).toBe(true);

    toggle.click();
    toggle.blur();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);

    toggle.click();
    document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = "/ja/docs/second";
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(switcher.querySelector('a[lang="en"]')?.getAttribute("href")).toBe(
      "/docs/second",
    );
    expect(switcher.querySelector('a[lang="de"]')?.getAttribute("href")).toBe(
      "/de/docs/second",
    );

    new Function(LANGUAGE_SWITCHER_INIT_SCRIPT)();
    new Function(LANGUAGE_SWITCHER_INIT_SCRIPT)();
    document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = "/ja/docs/third";
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    expect(switcher.querySelector('a[lang="en"]')?.getAttribute("href")).toBe(
      "/docs/third",
    );
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    document.body.innerHTML = serialize(
      <LanguageSwitcher
        links={links.map((link) => ({ ...link, active: link.code === "en" }))}
        accessibleLabel="Language"
        idSuffix="header"
        config={{ base: "", defaultLocale: "en", trailingSlash: false }}
        currentLocale="en"
      />,
    );
    document.documentElement.dataset[CURRENT_PATH_DATASET_KEY] = "/docs/replaced";
    new Function(LANGUAGE_SWITCHER_INIT_SCRIPT)();
    const replacementToggle = document.querySelector<HTMLButtonElement>(
      "[data-language-toggle]",
    )!;
    replacementToggle.click();
    expect(replacementToggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector('a[lang="ja"]')?.getAttribute("href")).toBe(
      "/ja/docs/replaced",
    );
  });
});
