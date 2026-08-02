import { describe, expect, it } from "vitest";
import { deriveNavDataPrep } from "../derive.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import type { ChromeContext } from "../../factory-context/index.js";

// A realistic navHref matching url-helpers' production semantics (base "/",
// default locale "en") — the fixture's own `navHref` stub is an identity
// function that ignores lang/version entirely, which would hide a broken
// `versioned` forward.
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

// Reach-assertion (3/4, mobile/root-menu output) for headerNav's `versioned`
// flag (#3216/#3190): `deriveNavDataPrep`'s `buildRootMenuItems` wraps
// `nav-data-prep`'s base builder in a forwarding lambda
// (`(path, l, v) => ctx.navHref(path, l, v)`, chrome/derive.tsx) that does NOT
// auto-forward a new 4th argument — this must exercise that exact lambda, not
// just the base builder directly.
describe("deriveNavDataPrep(ctx).buildRootMenuItems — versioned forwarding (#3216/#3190)", () => {
  function makeCtx(): ChromeContext {
    return makeFakeChromeContext({
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
  }

  it("suppresses the version prefix for a top-level item with versioned: false", () => {
    const { buildRootMenuItems } = deriveNavDataPrep(makeCtx());
    const items = buildRootMenuItems("en", "1.0");
    expect(items[0]?.href).toBe("/docs/claude");
  });

  it("suppresses the version prefix for a child item with versioned: false", () => {
    const { buildRootMenuItems } = deriveNavDataPrep(makeCtx());
    const items = buildRootMenuItems("en", "1.0");
    expect(items[1]?.children).toEqual([
      { label: "Intro", href: "/docs/guides/intro" },
      { label: "Advanced", href: "/v/1.0/docs/guides/advanced" },
    ]);
  });

  it("keeps the version prefix for the default (omitted) top-level item", () => {
    const { buildRootMenuItems } = deriveNavDataPrep(makeCtx());
    const items = buildRootMenuItems("en", "1.0");
    expect(items[1]?.href).toBe("/v/1.0/docs/guides");
  });
});
