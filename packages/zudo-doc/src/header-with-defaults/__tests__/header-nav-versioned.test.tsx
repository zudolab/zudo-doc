/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { createHeaderWithDefaults } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import type { ChromeContext } from "../../factory-context/index.js";

// A realistic navHref matching url-helpers' production semantics (base "/",
// default locale "en") — the fixture's own `navHref` stub is an identity
// function that ignores lang/version entirely, which would hide a broken
// `versioned` forward at either `header-with-defaults/index.tsx`'s
// `urlHelpers.navHref` lambda or `header/header.tsx`'s render call sites.
function realNavHref(
  path: string,
  lang: string | undefined,
  currentVersion: string | undefined,
  versioned = true,
): string {
  const isNonDefaultLocale = lang != null && lang !== "en";
  const versionPrefix = versioned && currentVersion ? `/v/${currentVersion}` : "";
  return isNonDefaultLocale ? `${versionPrefix}/${lang}${path}` : `${versionPrefix}${path}`;
}

// Reach-assertions (1, 2, 4) for headerNav's `versioned` flag (#3216/#3190).
// Renders through `createHeaderWithDefaults` (not a bare `<Header>` render) so
// the forwarding lambda at `header-with-defaults/index.tsx`'s
// `urlHelpers.navHref` is actually exercised — a lambda that dropped the 4th
// argument would still type-check but silently re-version every href.
describe("HeaderWithDefaults — versioned headerNav items (#3216/#3190)", () => {
  function render_(currentVersion: string | undefined) {
    const ctx = makeFakeChromeContext({
      settings: {
        headerNav: [
          { label: "Claude", path: "/docs/claude", versioned: false },
          {
            label: "Guides",
            path: "/docs/guides",
            children: [
              { label: "Intro", path: "/docs/guides/intro", versioned: false },
              { label: "Advanced", path: "/docs/guides/advanced" },
            ],
          },
        ],
      },
      overrides: { navHref: realNavHref } as Partial<ChromeContext>,
    });
    const HeaderWithDefaults = createHeaderWithDefaults(ctx);
    return render(
      <HeaderWithDefaults lang="en" currentPath="/docs/guides" currentVersion={currentVersion} />,
    );
  }

  it("(1) renders an unprefixed href for a top-level item with versioned: false", () => {
    const html = render_("1.0");
    expect(html).toContain('href="/docs/claude"');
    expect(html).not.toContain('href="/v/1.0/docs/claude"');
  });

  it("(2) renders an unprefixed href for a child dropdown item with versioned: false", () => {
    const html = render_("1.0");
    expect(html).toContain('href="/docs/guides/intro"');
    expect(html).not.toContain('href="/v/1.0/docs/guides/intro"');
  });

  it("(4) keeps the version prefix for the default (omitted) top-level and child items", () => {
    const html = render_("1.0");
    expect(html).toContain('href="/v/1.0/docs/guides"');
    expect(html).toContain('href="/v/1.0/docs/guides/advanced"');
  });
});
