/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Regression cover for zudolab/zudo-doc#4288.
 *
 * At 390px with a 24px browser font preference the header row used to push
 * its right-control cluster past the viewport edge, because every item in it
 * was unshrinkable. The site-name anchor is now the one item that can give
 * ground, so the deficit lands there as an ellipsis.
 *
 * The last case guards the toggle's own no-shrink pin. Note what it does NOT
 * prove: `header-with-defaults` hands the header an `Island(...)` wrapper —
 * an unclassed `<div>` — so in the package's own rendering the button is not
 * a flex item of the header row and its shrink pin is inert there; the
 * wrapper's min-content floor is what keeps the hamburger intact. The pin
 * binds only when a host renders `<SidebarToggle>` straight into the
 * `sidebarToggle` slot, which is the case this test covers.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { Header, type HeaderProps } from "../header.js";
import { SidebarToggle } from "../../sidebar-toggle-island/index.js";

const LONG_SITE_NAME = "A Very Long Documentation Site Name";

function makeHeaderProps(overrides: Partial<HeaderProps> = {}): HeaderProps {
  return {
    lang: "en",
    currentPath: "/docs/registry",
    persistKey: "header-en",
    siteName: LONG_SITE_NAME,
    headerNav: [],
    headerRightItems: [],
    colorModeEnabled: true,
    hasLocales: true,
    hasVersions: false,
    githubRepoUrl: "https://github.com/example/docs",
    githubLabel: "GitHub",
    themeToggle: <span data-theme>Theme</span>,
    languageSwitcher: <span data-language>Language</span>,
    versionSwitcher: <span data-version>Version</span>,
    search: <span data-search>Search</span>,
    urlHelpers: {
      withBase: (path) => path,
      stripBase: (path) => path,
      navHref: (path) => path,
    },
    i18n: {
      defaultLocale: "en",
      locales: ["en", "ja"],
      t: (key) => key,
    },
    ...overrides,
  };
}

function logoTag(html: string): string {
  const match = /<a[^>]*data-header-logo[^>]*>/.exec(html);
  if (!match) throw new Error("no [data-header-logo] anchor in rendered header");
  return match[0];
}

describe("header site-name truncation", () => {
  it("makes the site-name anchor shrinkable and clipped with an ellipsis", () => {
    const tag = logoTag(render(<Header {...makeHeaderProps()} />));

    expect(tag).toContain("min-w-0");
    expect(tag).toContain("truncate");
    // shrink-0 here is what kept the row from ever giving ground (#4287).
    expect(tag).not.toContain("shrink-0");
  });

  it("exposes the untruncated site name as the anchor's title", () => {
    const tag = logoTag(render(<Header {...makeHeaderProps()} />));

    expect(tag).toContain(`title="${LONG_SITE_NAME}"`);
  });

  it("still renders the full site name as the anchor's text", () => {
    const html = render(<Header {...makeHeaderProps()} />);

    expect(html).toContain(`>${LONG_SITE_NAME}</a>`);
  });

  it("pins the mobile toggle against shrinking when a host slots it in directly", () => {
    const html = render(<SidebarToggle nodes={[]} />);
    const match = /<button[^>]*aria-label="Open sidebar"[^>]*>/.exec(html);

    expect(match).not.toBeNull();
    expect(match?.[0]).toContain("shrink-0");
  });
});
